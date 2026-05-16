import express, { Router } from 'express';
import {
  startSession,
  submitAnswer,
  completeSession,
  getMyAvatar,
  abandonAvatarSession,
} from '../controllers/avatarController';
import { validateDeviceId } from '@/middlewares/deviceAuth';

const router: Router = express.Router();

/**
 * All routes require device authentication via X-Device-ID header.
 */

/**
 * @route   POST /api/avatar/session/start
 * @desc    Start a new avatar session or resume in-progress one
 */
router.post('/session/start', validateDeviceId, startSession);

/**
 * @route   POST /api/avatar/session/:id/answer
 * @desc    Submit an answer for the current step; advances the state machine
 * @body    { answer: string }
 */
router.post('/session/:id/answer', validateDeviceId, submitAnswer);

/**
 * @route   POST /api/avatar/session/:id/complete
 * @desc    Synthesize and persist the final avatar
 */
router.post('/session/:id/complete', validateDeviceId, completeSession);

/**
 * @route   DELETE /api/avatar/session/:id
 * @desc    Abandon an in-progress session
 */
router.delete('/session/:id', validateDeviceId, abandonAvatarSession);

/**
 * @route   GET /api/avatar
 * @desc    Fetch the current avatar for the device, or null
 */
router.get('/', validateDeviceId, getMyAvatar);

export default router;
