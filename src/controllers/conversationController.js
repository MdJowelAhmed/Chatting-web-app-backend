import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

// @desc    Get all conversations for current user
// @route   GET /api/conversations
// @access  Private
export const getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', 'name avatar isOnline lastSeen')
      .populate('lastMessage')
      .populate('groupAdmin', 'name')
      .sort({ updatedAt: -1 });

    // Add unread count for current user
    const conversationsWithUnread = conversations.map((conv) => {
      const convObj = conv.toObject();
      convObj.unreadCount = conv.unreadCount?.get(req.user._id.toString()) || 0;
      return convObj;
    });

    res.status(200).json({
      success: true,
      data: conversationsWithUnread,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get or create private conversation
// @route   POST /api/conversations/private/:userId
// @access  Private
export const getOrCreatePrivateConversation = async (req, res, next) => {
  try {
    const otherUserId = req.params.userId;

    // Check if other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if blocked
    const currentUser = await User.findById(req.user._id);
    if (currentUser.blockedUsers.includes(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: 'You have blocked this user',
      });
    }

    const conversation = await Conversation.findOrCreatePrivate(req.user._id, otherUserId);

    // Populate last message if exists
    await conversation.populate('lastMessage');

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conversation by ID
// @route   GET /api/conversations/:id
// @access  Private
export const getConversationById = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants', 'name avatar isOnline lastSeen about')
      .populate('lastMessage')
      .populate('groupAdmin', 'name avatar');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Check if user is participant
    const isParticipant = conversation.participants.some(
      (p) => p._id.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this conversation',
      });
    }

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create group conversation
// @route   POST /api/conversations/group
// @access  Private
export const createGroupConversation = async (req, res, next) => {
  try {
    const { name, participants, description } = req.body;

    if (!name || !participants || participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Group name and at least 2 participants are required',
      });
    }

    // Add current user to participants
    const allParticipants = [...new Set([req.user._id.toString(), ...participants])];

    const conversation = await Conversation.create({
      type: 'group',
      groupName: name,
      groupDescription: description || '',
      participants: allParticipants,
      groupAdmin: [req.user._id],
      createdBy: req.user._id,
    });

    await conversation.populate('participants', 'name avatar isOnline lastSeen');

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update group info
// @route   PUT /api/conversations/group/:id
// @access  Private (Admin only)
export const updateGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation || conversation.type !== 'group') {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    // Check if user is admin
    const isAdmin = conversation.groupAdmin.some(
      (admin) => admin.toString() === req.user._id.toString()
    );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update group info',
      });
    }

    if (name) conversation.groupName = name;
    if (description !== undefined) conversation.groupDescription = description;

    await conversation.save();
    await conversation.populate('participants', 'name avatar isOnline lastSeen');

    res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add participants to group
// @route   POST /api/conversations/group/:id/participants
// @access  Private (Admin only)
export const addParticipants = async (req, res, next) => {
  try {
    const { participants } = req.body;
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation || conversation.type !== 'group') {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    // Check if user is admin
    const isAdmin = conversation.groupAdmin.some(
      (admin) => admin.toString() === req.user._id.toString()
    );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can add participants',
      });
    }

    // Add new participants
    const newParticipants = participants.filter(
      (p) => !conversation.participants.includes(p)
    );

    conversation.participants.push(...newParticipants);
    await conversation.save();
    await conversation.populate('participants', 'name avatar isOnline lastSeen');

    res.status(200).json({
      success: true,
      message: 'Participants added successfully',
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove participant from group
// @route   DELETE /api/conversations/group/:id/participants/:userId
// @access  Private (Admin only)
export const removeParticipant = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation || conversation.type !== 'group') {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    // Check if user is admin
    const isAdmin = conversation.groupAdmin.some(
      (admin) => admin.toString() === req.user._id.toString()
    );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can remove participants',
      });
    }

    // Remove participant
    conversation.participants = conversation.participants.filter(
      (p) => p.toString() !== req.params.userId
    );

    // Also remove from admin if they were admin
    conversation.groupAdmin = conversation.groupAdmin.filter(
      (admin) => admin.toString() !== req.params.userId
    );

    await conversation.save();
    await conversation.populate('participants', 'name avatar isOnline lastSeen');

    res.status(200).json({
      success: true,
      message: 'Participant removed successfully',
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Leave group
// @route   POST /api/conversations/group/:id/leave
// @access  Private
export const leaveGroup = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation || conversation.type !== 'group') {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    // Remove user from participants
    conversation.participants = conversation.participants.filter(
      (p) => p.toString() !== req.user._id.toString()
    );

    // Remove from admin if was admin
    conversation.groupAdmin = conversation.groupAdmin.filter(
      (admin) => admin.toString() !== req.user._id.toString()
    );

    // If no participants left, delete the group
    if (conversation.participants.length === 0) {
      await Conversation.findByIdAndDelete(req.params.id);
      return res.status(200).json({
        success: true,
        message: 'Group deleted as no participants left',
      });
    }

    // If no admin left, make first participant admin
    if (conversation.groupAdmin.length === 0) {
      conversation.groupAdmin.push(conversation.participants[0]);
    }

    await conversation.save();

    res.status(200).json({
      success: true,
      message: 'Left group successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Make user admin
// @route   POST /api/conversations/group/:id/admin/:userId
// @access  Private (Admin only)
export const makeAdmin = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation || conversation.type !== 'group') {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    // Check if current user is admin
    const isAdmin = conversation.groupAdmin.some(
      (admin) => admin.toString() === req.user._id.toString()
    );

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can make other users admin',
      });
    }

    // Check if user is participant
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.params.userId
    );

    if (!isParticipant) {
      return res.status(400).json({
        success: false,
        message: 'User is not a participant of this group',
      });
    }

    // Add to admin
    if (!conversation.groupAdmin.includes(req.params.userId)) {
      conversation.groupAdmin.push(req.params.userId);
      await conversation.save();
    }

    res.status(200).json({
      success: true,
      message: 'User is now an admin',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete conversation
// @route   DELETE /api/conversations/:id
// @access  Private
export const deleteConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // For groups, only creator can delete
    if (conversation.type === 'group') {
      if (conversation.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Only group creator can delete the group',
        });
      }
    }

    // Delete all messages in conversation
    await Message.deleteMany({ conversation: req.params.id });

    // Delete conversation
    await Conversation.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

