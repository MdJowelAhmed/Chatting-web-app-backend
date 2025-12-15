# WhatsApp Clone - Backend

A real-time messaging backend built with Node.js, Express, Socket.IO, and MongoDB.

## Features

- 🔐 JWT Authentication
- 💬 Real-time messaging with Socket.IO
- 📹 WebRTC signaling for audio/video calls
- 👥 Group chat support
- 📁 File upload (images, videos, audio, documents)
- 🎤 Voice message support
- ✅ Message status (sent, delivered, read)
- ⌨️ Typing indicators
- 🟢 Online/offline status

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.IO
- **Authentication**: JWT
- **File Upload**: Multer

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Installation

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file (copy from `env-example.txt`):
   ```bash
   cp env-example.txt .env
   ```

4. Update the `.env` file with your configuration.

5. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout user |
| PUT | `/api/auth/password` | Update password |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users (search) |
| GET | `/api/users/:id` | Get user by ID |
| PUT | `/api/users/profile` | Update profile |
| PUT | `/api/users/avatar` | Update avatar |
| POST | `/api/users/contacts/:userId` | Add contact |
| DELETE | `/api/users/contacts/:userId` | Remove contact |
| POST | `/api/users/block/:userId` | Block user |
| DELETE | `/api/users/block/:userId` | Unblock user |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | Get all conversations |
| GET | `/api/conversations/:id` | Get conversation by ID |
| POST | `/api/conversations/private/:userId` | Get/create private chat |
| POST | `/api/conversations/group` | Create group |
| PUT | `/api/conversations/group/:id` | Update group info |
| POST | `/api/conversations/group/:id/participants` | Add members |
| DELETE | `/api/conversations/group/:id/participants/:userId` | Remove member |
| POST | `/api/conversations/group/:id/leave` | Leave group |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/:conversationId` | Get messages |
| POST | `/api/messages/:conversationId` | Send text message |
| POST | `/api/messages/:conversationId/file` | Send file |
| POST | `/api/messages/:conversationId/voice` | Send voice message |
| PUT | `/api/messages/:conversationId/read` | Mark as read |
| DELETE | `/api/messages/:messageId` | Delete for me |
| DELETE | `/api/messages/:messageId/everyone` | Delete for everyone |
| POST | `/api/messages/:messageId/react` | React to message |
| POST | `/api/messages/:messageId/star` | Star message |

### Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/calls/initiate` | Start call |
| POST | `/api/calls/:callId/accept` | Accept call |
| POST | `/api/calls/:callId/reject` | Reject call |
| POST | `/api/calls/:callId/end` | End call |
| GET | `/api/calls/history` | Get call history |
| GET | `/api/calls/active` | Get active call |

## Socket Events

### Client → Server
- `send-message` - Send a message
- `typing-start` - Start typing indicator
- `typing-stop` - Stop typing indicator
- `messages-read` - Mark messages as read
- `call-user` - Initiate call
- `answer-call` - Answer incoming call
- `ice-candidate` - Send ICE candidate
- `reject-call` - Reject call
- `end-call` - End call
- `join-call-room` - Join group call
- `leave-call-room` - Leave group call

### Server → Client
- `new-message` - New message received
- `user-typing` - User is typing
- `user-stopped-typing` - User stopped typing
- `messages-read` - Messages marked as read
- `incoming-call-signal` - Incoming call
- `call-accepted` - Call was accepted
- `call-rejected` - Call was rejected
- `call-ended` - Call ended
- `user-online` - User came online
- `user-offline` - User went offline

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js      # MongoDB connection
│   │   └── socket.js        # Socket.IO setup
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── conversationController.js
│   │   ├── messageController.js
│   │   └── callController.js
│   ├── middleware/
│   │   ├── auth.js          # JWT authentication
│   │   ├── upload.js        # Multer file upload
│   │   └── errorHandler.js  # Error handling
│   ├── models/
│   │   ├── User.js
│   │   ├── Conversation.js
│   │   ├── Message.js
│   │   └── Call.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── conversationRoutes.js
│   │   ├── messageRoutes.js
│   │   └── callRoutes.js
│   ├── socket/
│   │   └── socketHandler.js # Socket event handlers
│   └── server.js            # Entry point
├── uploads/                  # Uploaded files
├── package.json
└── README.md
```

## License

MIT

