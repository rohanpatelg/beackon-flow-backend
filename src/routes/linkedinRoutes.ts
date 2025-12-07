import express, { Router } from 'express';
import {
  getLinkedInStatus,
  publishLinkedInPost,
  disconnectLinkedIn,
  generateHooks,
  generatePost,
  recommendContentIntention,
  regeneratePostSection,
  getSuggestion,
} from '../controllers/linkedinController';
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

/**
 * @route   POST /api/linkedin/generate-hooks
 * @desc    Generate LinkedIn post hooks from a topic using AI
 * @access  Private (requires Supabase JWT)
 * @body    { topic: string }
 */
router.post('/generate-hooks', validateSupabaseToken, generateHooks);

/**
 * @route   POST /api/linkedin/generate-post
 * @desc    Generate LinkedIn post content from a hook using AI
 * @access  Private (requires Supabase JWT)
 * @body    { hook: string, topic: string, intention?: string }
 */
router.post('/generate-post', validateSupabaseToken, generatePost);

/**
 * @route   POST /api/linkedin/recommend-intention
 * @desc    Get AI recommendation for best content framework
 * @access  Private (requires Supabase JWT)
 * @body    { hook: string, topic: string }
 */
router.post('/recommend-intention', validateSupabaseToken, recommendContentIntention);

/**
 * @route   POST /api/linkedin/regenerate-section
 * @desc    Regenerate a specific section of a post
 * @access  Private (requires Supabase JWT)
 * @body    { section: string, hook: string, topic: string, current_sections: object, intention?: string }
 */
router.post('/regenerate-section', validateSupabaseToken, regeneratePostSection);

/**
 * @route   POST /api/linkedin/get-suggestion
 * @desc    Get a suggestion for a LinkedIn post
 * @access  Private (requires Supabase JWT)
 */
router.post('/get-suggestion', validateSupabaseToken, getSuggestion);

export default router;
