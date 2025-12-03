import {
  fetchUserPostsFromDb,
  getPostByIdFromDb,
  updatePostInDb,
  softDeletePostInDb,
  updatePostStatusInDb,
  insertDraftPostInDb,
  FetchPostsOptions,
  UserPost,
} from '@/repositories/postsRepository';

/**
 * Fetch user's posts with filtering and pagination
 */
export const getUserPosts = async (options: FetchPostsOptions) => {
  return await fetchUserPostsFromDb(options);
};

/**
 * Get a single post by ID
 */
export const getPostById = async (postId: number, userId: string): Promise<UserPost | null> => {
  return await getPostByIdFromDb(postId, userId);
};

/**
 * Update post content
 */
export const updatePostContent = async (
  postId: number,
  userId: string,
  content: string
): Promise<UserPost> => {
  return await updatePostInDb(postId, userId, content);
};

/**
 * Soft delete a post
 */
export const deletePost = async (postId: number, userId: string): Promise<void> => {
  await softDeletePostInDb(postId, userId);
};

/**
 * Update post status
 */
export const updatePostStatus = async (
  postId: number,
  userId: string,
  status: number
): Promise<void> => {
  await updatePostStatusInDb(postId, userId, status);
};

/**
 * Create a new draft post
 */
export const createDraftPost = async (
  userId: string,
  hook: string,
  postContent: string
): Promise<UserPost> => {
  return await insertDraftPostInDb(userId, hook, postContent);
};
