import mongoose from 'mongoose';

const callSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        joinedAt: Date,
        leftAt: Date,
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rejected', 'missed', 'busy'],
          default: 'pending',
        },
      },
    ],
    type: {
      type: String,
      enum: ['audio', 'video'],
      required: true,
    },
    isGroupCall: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ringing', 'ongoing', 'ended', 'missed', 'rejected'],
      default: 'ringing',
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    duration: {
      type: Number, // in seconds
      default: 0,
    },
    // WebRTC room/session ID
    roomId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate duration on save
callSchema.pre('save', function (next) {
  if (this.startedAt && this.endedAt) {
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }
  next();
});

// Indexes
callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ 'participants.user': 1 });
callSchema.index({ roomId: 1 });

const Call = mongoose.model('Call', callSchema);

export default Call;

