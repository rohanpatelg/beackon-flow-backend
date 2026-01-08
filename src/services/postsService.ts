import {
  fetchUserPostsFromDb,
  getPostByIdFromDb,
  updatePostInDb,
  softDeletePostInDb,
  updatePostStatusInDb,
  insertDraftPostInDb,
  FetchPostsOptions,
  UserPost,
  PostSections,
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
export const getPostById = async (postId: number, deviceId: string): Promise<UserPost | null> => {
  return await getPostByIdFromDb(postId, deviceId);
};

/**
 * Update post content and optionally sections
 */
export const updatePostContent = async (
  postId: number,
  deviceId: string,
  content: string,
  sections?: PostSections
): Promise<UserPost> => {
  return await updatePostInDb(postId, deviceId, content, sections);
};

/**
 * Soft delete a post
 */
export const deletePost = async (postId: number, deviceId: string): Promise<void> => {
  await softDeletePostInDb(postId, deviceId);
};

/**
 * Update post status
 */
export const updatePostStatus = async (
  postId: number,
  deviceId: string,
  status: number
): Promise<void> => {
  await updatePostStatusInDb(postId, deviceId, status);
};

/**
 * Create a new draft post
 */
export const createDraftPost = async (
  deviceId: string,
  hook: string,
  postContent: string,
  sections?: PostSections,
  topic?: string,
  intention?: string
): Promise<UserPost> => {
  return await insertDraftPostInDb(deviceId, hook, postContent, sections, topic, intention);
};
