import { pool } from '@/config/database';

export interface FetchPostsOptions {
  userId: string;
  status?: number | 'all';
  page?: number;
  pageSize?: number;
}

// Structured sections for post editing
export interface PostSections {
  hook: string;
  intro: string;
  main_insight: string;
  supporting_detail: string;
  shift_takeaway: string;
  cta: string;
}

export interface UserPost {
  id: number;
  auth_user_id: string;
  hook: string;
  post: string;
  sections?: PostSections;  // Structured sections for editing
  topic?: string;           // Original topic for regeneration
  intention?: string;       // Content framework for regeneration
  status: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  linkedin_post_id?: string;
  linkedin_post_url?: string;
  published_at?: string;
}

/**
 * Fetch user's posts from m_users_posts table
 */
export const fetchUserPostsFromDb = async (options: FetchPostsOptions): Promise<{
  posts: UserPost[];
  total: number;
  hasMore: boolean;
}> => {
  const { userId, status = 'all', page = 1, pageSize = 10 } = options;
  console.log('fetchUserPostsFromDb', userId, status, page, pageSize);

  // Calculate pagination
  const offset = (page - 1) * pageSize;
  const limit = pageSize;

  // Build query
  let query = `
    SELECT * FROM public.m_users_posts
    WHERE auth_user_id = $1 AND is_deleted = false
  `;
  const params: any[] = [userId];

  // Add status filter if not 'all'
  if (status !== 'all') {
    query += ` AND status = $${params.length + 1}`;
    params.push(status);
  }

  // Add ordering and pagination
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  // Get total count
  let countQuery = `
    SELECT COUNT(*) as total FROM public.m_users_posts
    WHERE auth_user_id = $1 AND is_deleted = false
  `;
  const countParams: any[] = [userId];

  if (status !== 'all') {
    countQuery += ` AND status = $${countParams.length + 1}`;
    countParams.push(status);
  }

  try {
    // Execute both queries
    const [postsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    const posts = postsResult.rows;
    const total = parseInt(countResult.rows[0]?.total || '0', 10);
    const hasMore = total > offset + posts.length;

    return { posts, total, hasMore };
  } catch (error: any) {
    console.error('Error fetching posts:', error);
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }
};

/**
 * Get a single post by ID
 */
export const getPostByIdFromDb = async (postId: number, userId: string): Promise<UserPost | null> => {
  const query = `
    SELECT * FROM public.m_users_posts
    WHERE id = $1 AND auth_user_id = $2 AND is_deleted = false
  `;

  try {
    const result = await pool.query(query, [postId, userId]);
    return result.rows[0] || null;
  } catch (error: any) {
    console.error('Error fetching post by ID:', error);
    throw new Error(`Failed to fetch post: ${error.message}`);
  }
};

/**
 * Update post content and optionally sections
 */
export const updatePostInDb = async (
  postId: number,
  userId: string,
  content: string,
  sections?: PostSections
): Promise<UserPost> => {
  // Build query based on whether sections are provided
  const query = sections
    ? `
      UPDATE public.m_users_posts
      SET post = $1, sections = $2, updated_at = NOW()
      WHERE id = $3 AND auth_user_id = $4 AND is_deleted = false
      RETURNING *
    `
    : `
      UPDATE public.m_users_posts
      SET post = $1, updated_at = NOW()
      WHERE id = $2 AND auth_user_id = $3 AND is_deleted = false
      RETURNING *
    `;

  const params = sections
    ? [content, JSON.stringify(sections), postId, userId]
    : [content, postId, userId];

  try {
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      throw new Error('Post not found or you do not have permission to update it');
    }

    return result.rows[0];
  } catch (error: any) {
    console.error('Error updating post:', error);
    throw new Error(`Failed to update post: ${error.message}`);
  }
};

/**
 * Soft delete a post
 */
export const softDeletePostInDb = async (postId: number, userId: string): Promise<void> => {
  const query = `
    UPDATE public.m_users_posts
    SET is_deleted = true, updated_at = NOW()
    WHERE id = $1 AND auth_user_id = $2
  `;

  try {
    const result = await pool.query(query, [postId, userId]);

    if (result.rowCount === 0) {
      throw new Error('Post not found or you do not have permission to delete it');
    }
  } catch (error: any) {
    console.error('Error deleting post:', error);
    throw new Error(`Failed to delete post: ${error.message}`);
  }
};

/**
 * Update post status
 */
export const updatePostStatusInDb = async (postId: number, userId: string, status: number): Promise<void> => {
  const query = `
    UPDATE public.m_users_posts
    SET status = $1, updated_at = NOW()
    WHERE id = $2 AND auth_user_id = $3 AND is_deleted = false
  `;

  try {
    const result = await pool.query(query, [status, postId, userId]);

    if (result.rowCount === 0) {
      throw new Error('Post not found or you do not have permission to update it');
    }
  } catch (error: any) {
    console.error('Error updating post status:', error);
    throw new Error(`Failed to update post status: ${error.message}`);
  }
};

/**
 * Insert a new draft post
 */
export const insertDraftPostInDb = async (
  userId: string,
  hook: string,
  postContent: string,
  sections?: PostSections,
  topic?: string,
  intention?: string
): Promise<UserPost> => {
  const query = `
    INSERT INTO public.m_users_posts (auth_user_id, hook, post, sections, topic, intention, status, created_at, updated_at, is_deleted)
    VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW(), false)
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [
      userId,
      hook,
      postContent,
      sections ? JSON.stringify(sections) : null,
      topic || null,
      intention || null
    ]);
    return result.rows[0];
  } catch (error: any) {
    console.error('Error inserting draft post:', error);
    throw new Error(`Failed to insert draft post: ${error.message}`);
  }
};

/**
 * Update post with LinkedIn metadata after successful publish
 */
export const updatePostLinkedInMetadata = async (
  postId: number,
  userId: string,
  linkedinPostId: string,
  linkedinPostUrl: string
): Promise<UserPost> => {
  const query = `
    UPDATE public.m_users_posts
    SET
      linkedin_post_id = $1,
      linkedin_post_url = $2,
      status = 2,
      published_at = NOW(),
      updated_at = NOW()
    WHERE id = $3 AND auth_user_id = $4 AND is_deleted = false
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [linkedinPostId, linkedinPostUrl, postId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Post not found or you do not have permission to update it');
    }

    return result.rows[0];
  } catch (error: any) {
    console.error('Error updating post LinkedIn metadata:', error);
    throw new Error(`Failed to update post LinkedIn metadata: ${error.message}`);
  }
};
