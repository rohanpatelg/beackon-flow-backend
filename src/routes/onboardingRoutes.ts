import express, { Router } from 'express';
import { validateSupabaseToken } from '@/middlewares/supabaseAuth';
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

// Protected routes - Require authentication
router.get('/status', validateSupabaseToken, getOnboardingStatus);
router.get('/answers', validateSupabaseToken, getUserAnswers);
router.post('/answers', validateSupabaseToken, saveUserAnswers);
router.put('/answers', validateSupabaseToken, updateUserAnswers);

export default router;
