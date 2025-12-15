import express from 'express';
import {
  getMessages,
  sendMessage,
  sendFileMessage,
  sendVoiceMessage,
  markAsRead,
  deleteMessageForMe,
  deleteMessageForEveryone,
  reactToMessage,
  starMessage,
  getStarredMessages,
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';
import { uploadSingle, uploadVoice } from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Starred messages
router.get('/starred', getStarredMessages);

// Conversation messages
router.get('/:conversationId', getMessages);
router.post('/:conversationId', sendMessage);
router.post('/:conversationId/file', uploadSingle, sendFileMessage);
router.post('/:conversationId/voice', uploadVoice, sendVoiceMessage);
router.put('/:conversationId/read', markAsRead);

// Single message actions
router.delete('/:messageId', deleteMessageForMe);
router.delete('/:messageId/everyone', deleteMessageForEveryone);
router.post('/:messageId/react', reactToMessage);
router.post('/:messageId/star', starMessage);

export default router;

