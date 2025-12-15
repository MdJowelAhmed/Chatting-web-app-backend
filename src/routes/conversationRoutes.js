import express from 'express';
import {
  getConversations,
  getOrCreatePrivateConversation,
  getConversationById,
  createGroupConversation,
  updateGroup,
  addParticipants,
  removeParticipant,
  leaveGroup,
  makeAdmin,
  deleteConversation,
} from '../controllers/conversationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', getConversations);
router.get('/:id', getConversationById);
router.post('/private/:userId', getOrCreatePrivateConversation);
router.delete('/:id', deleteConversation);

// Group routes
router.post('/group', createGroupConversation);
router.put('/group/:id', updateGroup);
router.post('/group/:id/participants', addParticipants);
router.delete('/group/:id/participants/:userId', removeParticipant);
router.post('/group/:id/leave', leaveGroup);
router.post('/group/:id/admin/:userId', makeAdmin);

export default router;

