import express from 'express';
import {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getCallHistory,
  getActiveCall,
} from '../controllers/callController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/initiate', initiateCall);
router.post('/:callId/accept', acceptCall);
router.post('/:callId/reject', rejectCall);
router.post('/:callId/end', endCall);
router.get('/history', getCallHistory);
router.get('/active', getActiveCall);

export default router;

