import express, { Router } from 'express';
import {
  fetchUserPosts,
  fetchPostById,
  updatePost,
  deleteUserPost,
  updateUserPostStatus,
} from '@/controllers/postsController';
import { validateSupabaseToken } from '@/middlewares/supabaseAuth';

const router: Router = express.Router();

/**
 * All routes require Supabase authentication
 */

/**
 * @route   GET /api/posts
 * @desc    Get user's posts with filtering and pagination
 * @access  Private (requires Supabase JWT)
 * @query   status - Filter by status (1, 2, or 'all')
 * @query   page - Page number (default: 1)
 * @query   pageSize - Items per page (default: 10)
 */
router.get('/', validateSupabaseToken, fetchUserPosts);

/**
 * @route   GET /api/posts/:id
 * @desc    Get a single post by ID
 * @access  Private (requires Supabase JWT)
 */
router.get('/:id', validateSupabaseToken, fetchPostById);

/**
 * @route   PATCH /api/posts/:id
 * @desc    Update post content
 * @access  Private (requires Supabase JWT)
 * @body    { content: string }
 */
router.patch('/:id', validateSupabaseToken, updatePost);

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete a post (soft delete)
 * @access  Private (requires Supabase JWT)
 */
router.delete('/:id', validateSupabaseToken, deleteUserPost);

/**
 * @route   PATCH /api/posts/:id/status
 * @desc    Update post status
 * @access  Private (requires Supabase JWT)
 * @body    { status: number } (1=draft, 2=published)
 */
router.patch('/:id/status', validateSupabaseToken, updateUserPostStatus);

export default router;
