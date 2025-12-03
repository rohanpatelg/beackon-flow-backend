import { Request, Response } from 'express';
import {
  getUserPosts,
  getPostById,
  updatePostContent,
  deletePost,
  updatePostStatus,
} from '@/services/postsService';

/**
 * Get user's posts with filtering and pagination
 * @route GET /api/posts
 * @query status - Filter by status (1=draft, 2=published, or 'all')
 * @query page - Page number (default: 1)
 * @query pageSize - Items per page (default: 10)
 */
export const fetchUserPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.supabaseUser?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Parse query parameters
    const status = req.query.status === 'all' ? 'all' : parseInt(req.query.status as string) || 'all';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    // Fetch posts
    const result = await getUserPosts({
      userId,
      status,
      page,
      pageSize,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in fetchUserPosts controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch posts',
    });
  }
};

/**
 * Get a single post by ID
 * @route GET /api/posts/:id
 */
export const fetchPostById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.supabaseUser?.id;
    const postId = parseInt(req.params.id);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (isNaN(postId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
      return;
    }

    const post = await getPostById(postId, userId);

    if (!post) {
      res.status(404).json({
        success: false,
        message: 'Post not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: post,
    });
  } catch (error: any) {
    console.error('Error in fetchPostById controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch post',
    });
  }
};

/**
 * Update post content
 * @route PATCH /api/posts/:id
 * @body { content: string }
 */
export const updatePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.supabaseUser?.id;
    const postId = parseInt(req.params.id);
    const { content } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (isNaN(postId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Content is required and must be a non-empty string',
      });
      return;
    }

    const updatedPost = await updatePostContent(postId, userId, content.trim());

    res.status(200).json({
      success: true,
      data: updatedPost,
    });
  } catch (error: any) {
    console.error('Error in updatePost controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update post',
    });
  }
};

/**
 * Delete a post (soft delete)
 * @route DELETE /api/posts/:id
 */
export const deleteUserPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.supabaseUser?.id;
    const postId = parseInt(req.params.id);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (isNaN(postId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
      return;
    }

    await deletePost(postId, userId);

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in deleteUserPost controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete post',
    });
  }
};

/**
 * Update post status
 * @route PATCH /api/posts/:id/status
 * @body { status: number } (1=draft, 2=published)
 */
export const updateUserPostStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.supabaseUser?.id;
    const postId = parseInt(req.params.id);
    const { status } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (isNaN(postId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid post ID',
      });
      return;
    }

    if (![1, 2].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Status must be 1 (draft) or 2 (published)',
      });
      return;
    }

    await updatePostStatus(postId, userId, status);

    res.status(200).json({
      success: true,
      message: 'Post status updated successfully',
    });
  } catch (error: any) {
    console.error('Error in updateUserPostStatus controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update post status',
    });
  }
};
