import { Request, Response } from 'express';
import { generateHooksFromTopic, generatePostFromHook, recommendIntention, publishToLinkedIn, regenerateSection as regenerateSectionService, SectionKey, PostSections } from '@/services/linkedinService';
import { updatePostLinkedInMetadata, updatePostStatusInDb } from '@/repositories/postsRepository';

/**
 * Generate hooks from a topic
 * @route POST /api/linkedin/generate-hooks
 */
export const generateHooks = async (req: Request, res: Response): Promise<void> => {
  console.log('generateHooks controller', req.body);
  try {
    const { topic } = req.body;

    // Validate input
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Topic is required and must be a non-empty string',
      });
      return;
    }

    // Get user profile from Supabase user (optional)
    const userProfile = req.supabaseUser?.user_metadata;

    // Generate hooks using AI
    const hooks = await generateHooksFromTopic(topic.trim(), userProfile);

    res.status(200).json({
      success: true,
      data: {
        hooks,
        topic: topic.trim(),
      },
    });
  } catch (error: any) {
    console.error('Error in generateHooks controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate hooks',
    });
  }
};

/**
 * Generate LinkedIn post from a hook
 * Returns structured sections for granular editing
 * @route POST /api/linkedin/generate-post
 */
export const generatePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hook, topic, intention } = req.body;

    // Validate input
    if (!hook || typeof hook !== 'string' || hook.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Hook is required and must be a non-empty string',
      });
      return;
    }

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Topic is required and must be a non-empty string',
      });
      return;
    }

    // Get user profile from Supabase user (optional)
    const userProfile = req.supabaseUser?.user_metadata;

    // Generate post using AI with the selected content framework
    const result = await generatePostFromHook(
      hook.trim(),
      topic.trim(),
      intention?.trim(),
      userProfile
    );

    res.status(200).json({
      success: true,
      data: {
        sections: result.sections,
        design_idea: result.design_idea,
        hook: hook.trim(),
      },
    });
  } catch (error: any) {
    console.error('Error in generatePost controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate post',
    });
  }
};

/**
 * Recommend content framework/intention for a hook and topic
 * @route POST /api/linkedin/recommend-intention
 */
export const recommendContentIntention = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hook, topic } = req.body;

    // Validate input
    if (!hook || typeof hook !== 'string' || hook.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Hook is required and must be a non-empty string',
      });
      return;
    }

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Topic is required and must be a non-empty string',
      });
      return;
    }

    // Get AI recommendation for best content framework
    const intention = await recommendIntention(hook.trim(), topic.trim());

    res.status(200).json({
      success: true,
      intention,
    });
  } catch (error: any) {
    console.error('Error in recommendContentIntention controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to recommend intention',
    });
  }
};

/**
 * Regenerate a specific section of a post
 * @route POST /api/linkedin/regenerate-section
 * @body { section: SectionKey, hook: string, topic: string, current_sections: PostSections, intention?: string }
 */
export const regeneratePostSection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { section, hook, topic, current_sections, intention } = req.body;

    // Validate section key
    const validSections: SectionKey[] = ['intro', 'main_insight', 'supporting_detail', 'shift_takeaway', 'cta'];
    if (!section || !validSections.includes(section)) {
      res.status(400).json({
        success: false,
        message: `Invalid section. Must be one of: ${validSections.join(', ')}`,
      });
      return;
    }

    // Validate hook
    if (!hook || typeof hook !== 'string' || hook.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Hook is required and must be a non-empty string',
      });
      return;
    }

    // Validate topic
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Topic is required and must be a non-empty string',
      });
      return;
    }

    // Validate current_sections
    if (!current_sections || typeof current_sections !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Current sections object is required',
      });
      return;
    }

    // Regenerate the section
    const newSectionContent = await regenerateSectionService(
      section,
      hook.trim(),
      topic.trim(),
      current_sections as PostSections,
      intention?.trim()
    );

    res.status(200).json({
      success: true,
      data: {
        section,
        content: newSectionContent,
      },
    });
  } catch (error: any) {
    console.error('Error in regeneratePostSection controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to regenerate section',
    });
  }
};

/**
 * Publish post to LinkedIn
 * @route POST /api/linkedin/publish
 * @body { post_text: string, linkedin_token: string, generated_post_id?: number }
 */
export const publishLinkedInPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { post_text, linkedin_token, generated_post_id } = req.body;
    const userId = req.supabaseUser?.id;

    // Validate required fields
    if (!post_text || typeof post_text !== 'string' || post_text.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Post text is required and must be a non-empty string',
      });
      return;
    }

    if (!linkedin_token || typeof linkedin_token !== 'string') {
      res.status(400).json({
        success: false,
        message: 'LinkedIn access token is required',
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Validate post length (LinkedIn limit is ~3000 characters)
    if (post_text.length > 3000) {
      res.status(400).json({
        success: false,
        message: 'Post text exceeds LinkedIn character limit (3000 characters)',
      });
      return;
    }

    console.log('Publishing to LinkedIn for user:', userId);

    // Publish to LinkedIn
    const publishResult = await publishToLinkedIn(linkedin_token, post_text.trim());

    if (!publishResult.success) {
      res.status(400).json({
        success: false,
        message: publishResult.error || 'Failed to publish to LinkedIn',
      });
      return;
    }

    // If we have a generated_post_id, update the database with LinkedIn metadata
    if (generated_post_id && publishResult.postId) {
      try {
        await updatePostLinkedInMetadata(
          generated_post_id,
          userId,
          publishResult.postId,
          publishResult.postUrl || ''
        );
        console.log('Post metadata updated in database');
      } catch (dbError: any) {
        // Log but don't fail - the LinkedIn post was successful
        console.error('Failed to update post metadata in database:', dbError.message);
      }
    } else if (generated_post_id) {
      // Even without LinkedIn post ID, update status to published
      try {
        await updatePostStatusInDb(generated_post_id, userId, 2);
      } catch (dbError: any) {
        console.error('Failed to update post status:', dbError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Post published to LinkedIn successfully',
      data: {
        linkedin_post_id: publishResult.postId,
        linkedin_post_url: publishResult.postUrl,
      },
    });
  } catch (error: any) {
    console.error('Error in publishLinkedInPost controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to publish post to LinkedIn',
    });
  }
};

/**
 * Get LinkedIn connection status
 * @route GET /api/linkedin/status
 */
export const getLinkedInStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if user has LinkedIn provider in their Supabase metadata
    const user = req.supabaseUser;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    const hasLinkedIn = user.app_metadata?.providers?.includes('linkedin') ||
      user.user_metadata?.provider === 'linkedin';

    res.status(200).json({
      success: true,
      data: {
        authenticated: hasLinkedIn,
        profile: hasLinkedIn ? {
          linkedin_id: user.user_metadata?.provider_id || user.user_metadata?.sub,
          name: user.user_metadata?.name || user.user_metadata?.full_name,
          email: user.email,
          picture: user.user_metadata?.picture || user.user_metadata?.avatar_url,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Error in getLinkedInStatus controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get LinkedIn status',
    });
  }
};

/**
 * Disconnect LinkedIn (handled client-side with Supabase)
 * @route DELETE /api/linkedin/disconnect
 */
export const disconnectLinkedIn = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'LinkedIn disconnect is handled client-side via Supabase sign out',
    });
  } catch (error: any) {
    console.error('Error in disconnectLinkedIn controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to disconnect LinkedIn',
    });
  }
};

/**
 * Get suggestion (placeholder)
 * @route POST /api/linkedin/get-suggestion
 */
export const getSuggestion = async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: Implement suggestion logic
    res.status(501).json({
      success: false,
      message: 'Get suggestion is not yet implemented',
    });
  } catch (error: any) {
    console.error('Error in getSuggestion controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get suggestion',
    });
  }
};
