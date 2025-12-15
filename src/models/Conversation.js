import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    type: {
      type: String,
      enum: ['private', 'group'],
      default: 'private',
    },
    // Group specific fields
    groupName: {
      type: String,
      trim: true,
    },
    groupAvatar: {
      type: String,
      default: '',
    },
    groupDescription: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    groupAdmin: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Last message reference for chat list
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    // Unread count per user
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
    // Pinned status per user
    pinnedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Muted status per user
    mutedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        until: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

// Static method to find or create private conversation
conversationSchema.statics.findOrCreatePrivate = async function (user1Id, user2Id) {
  let conversation = await this.findOne({
    type: 'private',
    participants: { $all: [user1Id, user2Id], $size: 2 },
  }).populate('participants', 'name avatar isOnline lastSeen');

  if (!conversation) {
    conversation = await this.create({
      type: 'private',
      participants: [user1Id, user2Id],
    });
    conversation = await conversation.populate('participants', 'name avatar isOnline lastSeen');
  }

  return conversation;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;

