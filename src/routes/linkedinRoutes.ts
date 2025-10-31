import express, { Router } from 'express';
import {
  getLinkedInStatus,
  publishLinkedInPost,
  disconnectLinkedIn,
} from '@/controllers/linkedinController';
import { validateSupabaseToken } from '@/middlewares/supabaseAuth';

const router: Router = express.Router();

/**
 * All routes require Supabase authentication
 * OAuth flow is handled entirely by Supabase on the client side
 */

/**
 * @route   GET /api/linkedin/status
 * @desc    Get LinkedIn authentication status
 * @access  Private (requires Supabase JWT)
 */
router.get('/status', validateSupabaseToken, getLinkedInStatus);

/**
 * @route   POST /api/linkedin/publish
 * @desc    Publish a post to LinkedIn
 * @access  Private (requires Supabase JWT)
 * @body    { post_text: string, provider_token: string }
 */
router.post('/publish', validateSupabaseToken, publishLinkedInPost);

/**
 * @route   DELETE /api/linkedin/disconnect
 * @desc    Disconnect LinkedIn account (handled client-side with Supabase)
 * @access  Private (requires Supabase JWT)
 */
router.delete('/disconnect', validateSupabaseToken, disconnectLinkedIn);

export default router;
