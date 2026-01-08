import express, { Router } from 'express';
import { validateDeviceId } from '@/middlewares/deviceAuth';
import {
  getQuestions,
  getOnboardingStatus,
  getUserAnswers,
  saveUserAnswers,
  updateUserAnswers,
} from '@/controllers/onboardingController';

const router: Router = express.Router();

// Public route - Get questions (no auth needed to display questions)
router.get('/questions', getQuestions);

// Protected routes - Require device authentication via X-Device-ID header
router.get('/status', validateDeviceId, getOnboardingStatus);
router.get('/answers', validateDeviceId, getUserAnswers);
router.post('/answers', validateDeviceId, saveUserAnswers);
router.put('/answers', validateDeviceId, updateUserAnswers);

export default router;
