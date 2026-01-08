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
import { validateDeviceId } from '@/middlewares/deviceAuth';

const router: Router = express.Router();

/**
 * All routes require device authentication via X-Device-ID header
 */

/**
 * @route   GET /api/linkedin/status
 * @desc    Get LinkedIn authentication status (disabled - returns not available)
 * @access  Private (requires X-Device-ID header)
 */
router.get('/status', validateDeviceId, getLinkedInStatus);

/**
 * @route   POST /api/linkedin/publish
 * @desc    Publish a post to LinkedIn (disabled for now)
 * @access  Private (requires X-Device-ID header)
 * @body    { post_text: string, provider_token: string }
 */
router.post('/publish', validateDeviceId, publishLinkedInPost);

/**
 * @route   DELETE /api/linkedin/disconnect
 * @desc    Disconnect LinkedIn account (disabled)
 * @access  Private (requires X-Device-ID header)
 */
router.delete('/disconnect', validateDeviceId, disconnectLinkedIn);

/**
 * @route   POST /api/linkedin/generate-hooks
 * @desc    Generate LinkedIn post hooks from a topic using AI
 * @access  Private (requires X-Device-ID header)
 * @body    { topic: string }
 */
router.post('/generate-hooks', validateDeviceId, generateHooks);

/**
 * @route   POST /api/linkedin/generate-post
 * @desc    Generate LinkedIn post content from a hook using AI
 * @access  Private (requires X-Device-ID header)
 * @body    { hook: string, topic: string, intention?: string }
 */
router.post('/generate-post', validateDeviceId, generatePost);

/**
 * @route   POST /api/linkedin/recommend-intention
 * @desc    Get AI recommendation for best content framework
 * @access  Private (requires X-Device-ID header)
 * @body    { hook: string, topic: string }
 */
router.post('/recommend-intention', validateDeviceId, recommendContentIntention);

/**
 * @route   POST /api/linkedin/regenerate-section
 * @desc    Regenerate a specific section of a post
 * @access  Private (requires X-Device-ID header)
 * @body    { section: string, hook: string, topic: string, current_sections: object, intention?: string }
 */
router.post('/regenerate-section', validateDeviceId, regeneratePostSection);

/**
 * @route   POST /api/linkedin/get-suggestion
 * @desc    Get a suggestion for a LinkedIn post
 * @access  Private (requires X-Device-ID header)
 */
router.post('/get-suggestion', validateDeviceId, getSuggestion);

export default router;
