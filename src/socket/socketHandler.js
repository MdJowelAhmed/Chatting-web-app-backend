import User from '../models/User.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { socketAuth } from '../middleware/auth.js';

// Store active connections
const onlineUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId

export const setupSocketHandlers = (io) => {
  // Apply authentication middleware
  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🟢 User connected: ${socket.user.name} (${userId})`);

    // Store user's socket
    onlineUsers.set(userId, socket.id);
    userSockets.set(socket.id, userId);

    // Update user status in database
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      socketId: socket.id,
    });

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Notify contacts about online status
    socket.broadcast.emit('user-online', { userId });

    // Join all conversation rooms
    const conversations = await Conversation.find({ participants: userId });
    conversations.forEach((conv) => {
      socket.join(`conversation:${conv._id}`);
    });

    // ============ MESSAGING EVENTS ============

    // Handle sending message via socket
    socket.on('send-message', async (data) => {
      try {
        const { conversationId, content, type = 'text', replyTo } = data;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        // Create message
        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content,
          type,
          replyTo,
        });

        // Update conversation
        conversation.lastMessage = message._id;
        conversation.participants.forEach((participant) => {
          if (participant.toString() !== userId) {
            const currentCount = conversation.unreadCount.get(participant.toString()) || 0;
            conversation.unreadCount.set(participant.toString(), currentCount + 1);
          }
        });
        await conversation.save();

        // Populate message
        await message.populate('sender', 'name avatar');
        await message.populate('replyTo', 'content type sender');

        // Emit to conversation room
        io.to(`conversation:${conversationId}`).emit('new-message', message);

        // Mark as delivered for online participants
        conversation.participants.forEach((participant) => {
          const participantId = participant.toString();
          if (participantId !== userId && onlineUsers.has(participantId)) {
            message.deliveredTo.push({
              user: participantId,
              deliveredAt: new Date(),
            });
          }
        });

        if (message.deliveredTo.length > 0) {
          message.status = 'delivered';
          await message.save();
          io.to(`conversation:${conversationId}`).emit('message-status-update', {
            messageId: message._id,
            status: 'delivered',
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing-start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user-typing', {
        conversationId,
        userId,
        userName: socket.user.name,
      });
    });

    socket.on('typing-stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('user-stopped-typing', {
        conversationId,
        userId,
      });
    });

    // Handle message read
    socket.on('messages-read', async ({ conversationId }) => {
      try {
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userId },
            status: { $ne: 'read' },
          },
          {
            $set: { status: 'read' },
            $push: {
              readBy: {
                user: userId,
                readAt: new Date(),
              },
            },
          }
        );

        // Reset unread count
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          conversation.unreadCount.set(userId, 0);
          await conversation.save();
        }

        socket.to(`conversation:${conversationId}`).emit('messages-read', {
          conversationId,
          userId,
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // ============ WEBRTC SIGNALING EVENTS ============

    // Handle call initiation
    socket.on('call-user', async ({ userToCall, signalData, callType, callId }) => {
      const targetSocketId = onlineUsers.get(userToCall);
      if (targetSocketId) {
        io.to(targetSocketId).emit('incoming-call-signal', {
          signal: signalData,
          from: userId,
          callerName: socket.user.name,
          callerAvatar: socket.user.avatar,
          callType,
          callId,
        });
      } else {
        socket.emit('user-unavailable', { userId: userToCall });
      }
    });

    // Handle call answer
    socket.on('answer-call', ({ signal, to, callId }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call-accepted', {
          signal,
          from: userId,
          callId,
        });
      }
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ candidate, to }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('ice-candidate', {
          candidate,
          from: userId,
        });
      }
    });

    // Handle call rejection
    socket.on('reject-call', ({ to, callId }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call-rejected', {
          from: userId,
          callId,
        });
      }
    });

    // Handle call end
    socket.on('end-call', ({ to, callId }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call-ended', {
          from: userId,
          callId,
        });
      }
    });

    // Handle busy status
    socket.on('user-busy', ({ to, callId }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('user-busy', {
          from: userId,
          callId,
        });
      }
    });

    // ============ GROUP CALL EVENTS ============

    // Join a call room
    socket.on('join-call-room', ({ roomId }) => {
      socket.join(`call:${roomId}`);
      socket.to(`call:${roomId}`).emit('user-joined-call', {
        userId,
        userName: socket.user.name,
        userAvatar: socket.user.avatar,
      });
    });

    // Leave a call room
    socket.on('leave-call-room', ({ roomId }) => {
      socket.leave(`call:${roomId}`);
      socket.to(`call:${roomId}`).emit('user-left-call', {
        userId,
        userName: socket.user.name,
      });
    });

    // Group call signaling
    socket.on('group-call-signal', ({ roomId, userToSignal, signal }) => {
      const targetSocketId = onlineUsers.get(userToSignal);
      if (targetSocketId) {
        io.to(targetSocketId).emit('group-call-signal', {
          signal,
          from: userId,
          fromName: socket.user.name,
          roomId,
        });
      }
    });

    // Group call return signal
    socket.on('group-call-return-signal', ({ to, signal }) => {
      const targetSocketId = onlineUsers.get(to);
      if (targetSocketId) {
        io.to(targetSocketId).emit('group-call-signal-returned', {
          signal,
          from: userId,
        });
      }
    });

    // ============ SCREEN SHARING EVENTS ============

    socket.on('screen-share-started', ({ conversationId, roomId }) => {
      const room = roomId ? `call:${roomId}` : `conversation:${conversationId}`;
      socket.to(room).emit('screen-share-started', {
        userId,
        userName: socket.user.name,
      });
    });

    socket.on('screen-share-stopped', ({ conversationId, roomId }) => {
      const room = roomId ? `call:${roomId}` : `conversation:${conversationId}`;
      socket.to(room).emit('screen-share-stopped', {
        userId,
      });
    });

    // ============ PRESENCE EVENTS ============

    // Handle join conversation (for real-time updates)
    socket.on('join-conversation', ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave-conversation', ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ============ DISCONNECT ============

    socket.on('disconnect', async () => {
      console.log(`🔴 User disconnected: ${socket.user.name} (${userId})`);

      // Remove from maps
      onlineUsers.delete(userId);
      userSockets.delete(socket.id);

      // Update user status
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
        socketId: '',
      });

      // Notify contacts about offline status
      socket.broadcast.emit('user-offline', {
        userId,
        lastSeen: new Date(),
      });
    });
  });

  return io;
};

// Helper function to get online users
export const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

// Helper function to check if user is online
export const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

// Helper function to get user's socket ID
export const getUserSocketId = (userId) => {
  return onlineUsers.get(userId);
};

