import Call from '../models/Call.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../config/socket.js';

// @desc    Initiate a call
// @route   POST /api/calls/initiate
// @access  Private
export const initiateCall = async (req, res, next) => {
  try {
    const { receiverId, type, isGroupCall = false, conversationId } = req.body;

    if (!type || !['audio', 'video'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Call type must be audio or video',
      });
    }

    let participants = [];
    let conversation;

    if (isGroupCall && conversationId) {
      // Group call
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found',
        });
      }

      participants = conversation.participants
        .filter((p) => p.toString() !== req.user._id.toString())
        .map((p) => ({
          user: p,
          status: 'pending',
        }));
    } else {
      // Private call
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Get or create conversation
      conversation = await Conversation.findOrCreatePrivate(req.user._id, receiverId);
      participants = [{ user: receiverId, status: 'pending' }];
    }

    const roomId = uuidv4();

    // Create call record
    const call = await Call.create({
      conversation: conversation._id,
      caller: req.user._id,
      participants,
      type,
      isGroupCall,
      roomId,
    });

    await call.populate('caller', 'name email avatar');
    await call.populate('participants.user', 'name email avatar socketId');

    // Emit call invitation to participants
    const io = getIO();
    
    call.participants.forEach((participant) => {
      if (participant.user.socketId) {
        io.to(participant.user.socketId).emit('incoming-call', {
          call: call.toObject(),
          caller: {
            _id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            avatar: req.user.avatar,
          },
        });
      }
    });

    res.status(201).json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept a call
// @route   POST /api/calls/:callId/accept
// @access  Private
export const acceptCall = async (req, res, next) => {
  try {
    const call = await Call.findById(req.params.callId)
      .populate('caller', 'name email avatar socketId')
      .populate('participants.user', 'name email avatar socketId');

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    // Find participant and update status
    const participantIndex = call.participants.findIndex(
      (p) => p.user._id.toString() === req.user._id.toString()
    );

    if (participantIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant of this call',
      });
    }

    call.participants[participantIndex].status = 'accepted';
    call.participants[participantIndex].joinedAt = new Date();

    // If this is the first accept, start the call
    if (call.status === 'ringing') {
      call.status = 'ongoing';
      call.startedAt = new Date();
    }

    await call.save();

    // Notify caller and other participants
    const io = getIO();
    
    if (call.caller.socketId) {
      io.to(call.caller.socketId).emit('call-accepted', {
        callId: call._id,
        acceptedBy: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          avatar: req.user.avatar,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject a call
// @route   POST /api/calls/:callId/reject
// @access  Private
export const rejectCall = async (req, res, next) => {
  try {
    const call = await Call.findById(req.params.callId)
      .populate('caller', 'name email avatar socketId')
      .populate('participants.user', 'name email avatar socketId');

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    // Find participant and update status
    const participantIndex = call.participants.findIndex(
      (p) => p.user._id.toString() === req.user._id.toString()
    );

    if (participantIndex === -1) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant of this call',
      });
    }

    call.participants[participantIndex].status = 'rejected';

    // If all participants rejected, end the call
    const allRejected = call.participants.every(
      (p) => p.status === 'rejected'
    );

    if (allRejected) {
      call.status = 'rejected';
      call.endedAt = new Date();
    }

    await call.save();

    // Notify caller
    const io = getIO();
    if (call.caller.socketId) {
      io.to(call.caller.socketId).emit('call-rejected', {
        callId: call._id,
        rejectedBy: {
          _id: req.user._id,
          name: req.user.name,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Call rejected',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    End a call
// @route   POST /api/calls/:callId/end
// @access  Private
export const endCall = async (req, res, next) => {
  try {
    const call = await Call.findById(req.params.callId)
      .populate('caller', 'socketId')
      .populate('participants.user', 'socketId');

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    // Update call status
    call.status = 'ended';
    call.endedAt = new Date();

    // Update participant leave time
    call.participants.forEach((p) => {
      if (!p.leftAt) {
        p.leftAt = new Date();
      }
    });

    await call.save();

    // Notify all participants
    const io = getIO();
    
    // Notify caller
    if (call.caller.socketId) {
      io.to(call.caller.socketId).emit('call-ended', {
        callId: call._id,
        endedBy: req.user._id,
        duration: call.duration,
      });
    }

    // Notify participants
    call.participants.forEach((p) => {
      if (p.user.socketId) {
        io.to(p.user.socketId).emit('call-ended', {
          callId: call._id,
          endedBy: req.user._id,
          duration: call.duration,
        });
      }
    });

    res.status(200).json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get call history
// @route   GET /api/calls/history
// @access  Private
export const getCallHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const calls = await Call.find({
      $or: [
        { caller: req.user._id },
        { 'participants.user': req.user._id },
      ],
    })
      .populate('caller', 'name email avatar')
      .populate('participants.user', 'name email avatar')
      .populate('conversation', 'type groupName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Call.countDocuments({
      $or: [
        { caller: req.user._id },
        { 'participants.user': req.user._id },
      ],
    });

    res.status(200).json({
      success: true,
      data: calls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active call
// @route   GET /api/calls/active
// @access  Private
export const getActiveCall = async (req, res, next) => {
  try {
    const call = await Call.findOne({
      $or: [
        { caller: req.user._id },
        { 'participants.user': req.user._id },
      ],
      status: { $in: ['ringing', 'ongoing'] },
    })
      .populate('caller', 'name email avatar')
      .populate('participants.user', 'name email avatar');

    res.status(200).json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

