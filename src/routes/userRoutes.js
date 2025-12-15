import express from 'express';
import {
  getUsers,
  getUserById,
  updateProfile,
  updateAvatar,
  addContact,
  removeContact,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', getUsers);
router.get('/blocked', getBlockedUsers);
router.get('/:id', getUserById);
router.put('/profile', updateProfile);
router.put('/avatar', uploadAvatar, updateAvatar);

// Contact routes
router.post('/contacts/:userId', addContact);
router.delete('/contacts/:userId', removeContact);

// Block routes
router.post('/block/:userId', blockUser);
router.delete('/block/:userId', unblockUser);

export default router;

