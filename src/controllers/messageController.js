import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { getIO } from '../config/socket.js';

// @desc    Get messages for a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Check if user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these messages',
      });
    }

    const messages = await Message.find({
      conversation: conversationId,
      deletedFor: { $ne: req.user._id },
    })
      .populate('sender', 'name email avatar')
      .populate('replyTo', 'content type sender')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({
      conversation: conversationId,
      deletedFor: { $ne: req.user._id },
    });

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Return in chronological order
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

// @desc    Send a message
// @route   POST /api/messages/:conversationId
// @access  Private
export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content, type = 'text', replyTo } = req.body;

    // Check conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Check if user is participant
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send message in this conversation',
      });
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      content,
      type,
      replyTo,
    });

    // Update conversation's last message
    conversation.lastMessage = message._id;
    
    // Increment unread count for other participants
    conversation.participants.forEach((participant) => {
      if (participant.toString() !== req.user._id.toString()) {
        const currentCount = conversation.unreadCount.get(participant.toString()) || 0;
        conversation.unreadCount.set(participant.toString(), currentCount + 1);
      }
    });
    
    await conversation.save();

    // Populate message
    await message.populate('sender', 'name email avatar');
    await message.populate('replyTo', 'content type sender');

    // Emit to socket
    const io = getIO();
    const roomId = `conversation:${conversationId}`;
    io.to(roomId).emit('new-message', message);

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send file message
// @route   POST /api/messages/:conversationId/file
// @access  Private
export const sendFileMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { replyTo } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Check conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Determine message type based on file
    let type = 'document';
    if (req.file.mimetype.startsWith('image/')) type = 'image';
    else if (req.file.mimetype.startsWith('video/')) type = 'video';
    else if (req.file.mimetype.startsWith('audio/')) type = 'audio';

    // Get the relative path
    const filePath = req.file.path.replace(/\\/g, '/').replace('./uploads/', '');

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      type,
      replyTo,
      file: {
        url: filePath,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.participants.forEach((participant) => {
      if (participant.toString() !== req.user._id.toString()) {
        const currentCount = conversation.unreadCount.get(participant.toString()) || 0;
        conversation.unreadCount.set(participant.toString(), currentCount + 1);
      }
    });
    await conversation.save();

    // Populate and emit
    await message.populate('sender', 'name email avatar');
    
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('new-message', message);

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send voice message
// @route   POST /api/messages/:conversationId/voice
// @access  Private
export const sendVoiceMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { duration } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No voice recording uploaded',
      });
    }

    // Check conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    const filePath = req.file.path.replace(/\\/g, '/').replace('./uploads/', '');

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      type: 'voice',
      file: {
        url: filePath,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        duration: parseInt(duration) || 0,
      },
    });

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.participants.forEach((participant) => {
      if (participant.toString() !== req.user._id.toString()) {
        const currentCount = conversation.unreadCount.get(participant.toString()) || 0;
        conversation.unreadCount.set(participant.toString(), currentCount + 1);
      }
    });
    await conversation.save();

    await message.populate('sender', 'name avatar');

    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('new-message', message);

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/:conversationId/read
// @access  Private
export const markAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    // Update all unread messages in conversation
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user._id },
        status: { $ne: 'read' },
      },
      {
        $set: { status: 'read' },
        $push: {
          readBy: {
            user: req.user._id,
            readAt: new Date(),
          },
        },
      }
    );

    // Reset unread count
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      conversation.unreadCount.set(req.user._id.toString(), 0);
      await conversation.save();
    }

    // Emit read status
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('messages-read', {
      conversationId,
      userId: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete message for me
// @route   DELETE /api/messages/:messageId
// @access  Private
export const deleteMessageForMe = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Add user to deletedFor array
    if (!message.deletedFor.includes(req.user._id)) {
      message.deletedFor.push(req.user._id);
      await message.save();
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete message for everyone
// @route   DELETE /api/messages/:messageId/everyone
// @access  Private
export const deleteMessageForEveryone = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Only sender can delete for everyone
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only sender can delete message for everyone',
      });
    }

    // Check if within time limit (e.g., 1 hour)
    const timeDiff = Date.now() - message.createdAt.getTime();
    const oneHour = 60 * 60 * 1000;

    if (timeDiff > oneHour) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete message after 1 hour',
      });
    }

    message.isDeletedForEveryone = true;
    message.content = '';
    message.file = undefined;
    await message.save();

    // Emit to socket
    const io = getIO();
    io.to(`conversation:${message.conversation}`).emit('message-deleted', {
      messageId: message._id,
      conversationId: message.conversation,
    });

    res.status(200).json({
      success: true,
      message: 'Message deleted for everyone',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    React to message
// @route   POST /api/messages/:messageId/react
// @access  Private
export const reactToMessage = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Remove existing reaction from this user
    message.reactions = message.reactions.filter(
      (r) => r.user.toString() !== req.user._id.toString()
    );

    // Add new reaction if emoji provided
    if (emoji) {
      message.reactions.push({
        user: req.user._id,
        emoji,
      });
    }

    await message.save();

    // Emit to socket so all participants see updated reactions in real-time
    const io = getIO();
    io.to(`conversation:${message.conversation}`).emit('message-reaction', {
      messageId: message._id,
      conversationId: message.conversation,
      reactions: message.reactions,
    });

    res.status(200).json({
      success: true,
      data: message.reactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Star/unstar message
// @route   POST /api/messages/:messageId/star
// @access  Private
export const starMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    const isStarred = message.starredBy.includes(req.user._id);

    if (isStarred) {
      message.starredBy = message.starredBy.filter(
        (id) => id.toString() !== req.user._id.toString()
      );
    } else {
      message.starredBy.push(req.user._id);
    }

    await message.save();

    res.status(200).json({
      success: true,
      message: isStarred ? 'Message unstarred' : 'Message starred',
      isStarred: !isStarred,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get starred messages
// @route   GET /api/messages/starred
// @access  Private
export const getStarredMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({
      starredBy: req.user._id,
    })
      .populate('sender', 'name email avatar')
      .populate('conversation', 'type groupName participants')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

