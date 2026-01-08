import express, { Router } from 'express';
import {
  fetchUserPosts,
  fetchPostById,
  updatePost,
  deleteUserPost,
  updateUserPostStatus,
  createUserDraftPost,
} from '@/controllers/postsController';
import { validateDeviceId } from '@/middlewares/deviceAuth';

const router: Router = express.Router();

/**
 * All routes require device authentication via X-Device-ID header
 */

/**
 * @route   GET /api/posts
 * @desc    Get user's posts with filtering and pagination
 * @access  Private (requires X-Device-ID header)
 * @query   status - Filter by status (1, 2, or 'all')
 * @query   page - Page number (default: 1)
 * @query   pageSize - Items per page (default: 10)
 */
router.get('/', validateDeviceId, fetchUserPosts);

/**
 * @route   POST /api/posts
 * @desc    Create a new draft post
 * @access  Private (requires X-Device-ID header)
 * @body    { hook: string, post_content: string }
 */
router.post('/', validateDeviceId, createUserDraftPost);

/**
 * @route   GET /api/posts/:id
 * @desc    Get a single post by ID
 * @access  Private (requires X-Device-ID header)
 */
router.get('/:id', validateDeviceId, fetchPostById);

/**
 * @route   PATCH /api/posts/:id
 * @desc    Update post content
 * @access  Private (requires X-Device-ID header)
 * @body    { content: string }
 */
router.patch('/:id', validateDeviceId, updatePost);

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete a post (soft delete)
 * @access  Private (requires X-Device-ID header)
 */
router.delete('/:id', validateDeviceId, deleteUserPost);

/**
 * @route   PATCH /api/posts/:id/status
 * @desc    Update post status
 * @access  Private (requires X-Device-ID header)
 * @body    { status: number } (1=draft, 2=published)
 */
router.patch('/:id/status', validateDeviceId, updateUserPostStatus);

export default router;
