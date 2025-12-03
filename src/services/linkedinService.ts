import { generateChatCompletion } from './openaiService';
import axios from 'axios';

// LinkedIn API base URL
const LINKEDIN_API_BASE = 'https://api.linkedin.com';

/**
 * LinkedIn API response types
 */
interface LinkedInUserInfo {
  sub: string; // This is the person URN ID (e.g., "ABC123xyz")
  name?: string;
  email?: string;
}

interface LinkedInPublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

/**
 * Generate LinkedIn post hooks from a topic using AI
 * @param topic - The topic to generate hooks for
 * @param userProfile - Optional user profile data for personalization
 */
export const generateHooksFromTopic = async (
  topic: string,
  userProfile?: any
): Promise<string[]> => {
  const systemPrompt = `You are an expert LinkedIn content creator specializing in creating engaging hooks that capture attention.

Your task is to generate 3-5 compelling hooks for LinkedIn posts based on the given topic.

Guidelines:
- Each hook should be 1-2 sentences maximum
- Hooks should be attention-grabbing and make people want to read more
- Use proven hook formulas (questions, bold statements, curiosity gaps, controversy, etc.)
- Make them relevant to the professional audience on LinkedIn
- Vary the style across different hooks

Return ONLY a JSON array of strings, nothing else. Example format:
["Hook 1 text here", "Hook 2 text here", "Hook 3 text here"]`;

  let userPrompt = `Topic: ${topic}`;

  // Add user profile context if available for personalization
  if (userProfile) {
    userPrompt += `\n\nUser Context: ${JSON.stringify(userProfile)}`;
  }

  try {
    const response = await generateChatCompletion(
      systemPrompt,
      userPrompt,
      'gpt-4o-mini', // Cost-effective model
      0.8 // Higher temperature for creativity
    );

    // Parse the JSON response
    const hooks = JSON.parse(response);

    if (!Array.isArray(hooks)) {
      throw new Error('Invalid response format from AI');
    }

    return hooks;
  } catch (error: any) {
    console.error('Error generating hooks:', error.message);
    throw new Error(`Failed to generate hooks: ${error.message}`);
  }
};

/**
 * Generate LinkedIn post content from a hook using AI
 * @param hook - The selected hook
 * @param topic - The original topic
 * @param intention - Content framework/structure to follow
 * @param userProfile - Optional user profile data for personalization
 */
export const generatePostFromHook = async (
  hook: string,
  topic: string,
  intention?: string,
  userProfile?: any
): Promise<{ linkedin_post: string; design_idea: string }> => {
  // Framework-specific instructions
  const frameworkInstructions: { [key: string]: string } = {
    'Story → Insight → Shift': 'Share a personal story or example, extract a key insight from it, then show how that insight shifts perspective or challenges assumptions.',
    'Problem → Stakes → Solution': 'Clearly state the problem, explain why it matters and what\'s at risk if ignored, then present your solution or approach.',
    'Insight → Proof → Takeaway': 'Lead with a surprising or valuable insight, back it up with evidence or examples, then provide a clear actionable takeaway.',
    'Identity Gap → Mirror → Reframe': 'Highlight a disconnect between how people see themselves and reality, hold up a mirror to show the truth, then reframe how they should think about it.',
    'Contrarian Take → Explanation → New Rule': 'Present a contrarian or unpopular opinion, explain your reasoning thoroughly, then propose a new way of thinking or rule to follow.',
    'Before → After → Lesson': 'Describe the "before" state or situation, show the "after" transformation or result, then share the key lesson learned.',
    'Claim → Evidence → Example': 'Make a bold claim or statement, provide supporting evidence or data, then illustrate with a concrete example.',
    'List Format (3-5 punchy points)': 'Create a numbered or bulleted list of 3-5 key points, each one concise and valuable. Make each point actionable or insightful.',
    'Fast Rant → Clarifier → Resolution': 'Start with an energetic rant about something frustrating, clarify what you really mean or the core issue, then offer a constructive resolution or path forward.'
  };

  const frameworkGuidance = intention && frameworkInstructions[intention]
    ? `\n\nIMPORTANT - Follow this content framework: "${intention}"
Structure your post using this pattern: ${frameworkInstructions[intention]}`
    : '';

  const systemPrompt = `You are an expert LinkedIn content creator who writes engaging, professional posts.

Your task is to create a complete LinkedIn post based on the given hook and topic, plus a design/visual idea.${frameworkGuidance}

Guidelines for the post:
- Start with the provided hook
- Expand on the topic with valuable insights
- Use short paragraphs and line breaks for readability
- Include relevant emojis sparingly (1-3 max)
- End with a call-to-action or question to encourage engagement
- Keep it under 1300 characters (LinkedIn's limit)
- Professional yet conversational tone
${intention ? `- Structure the content following the "${intention}" framework pattern` : ''}

Guidelines for design idea:
- Suggest a simple visual or graphic idea that complements the post
- Keep it practical and easy to create
- Can be: infographic, quote card, photo idea, chart, etc.

Return ONLY a JSON object with this exact format:
{
  "linkedin_post": "The complete post text here...",
  "design_idea": "Description of visual/design suggestion here"
}`;

  let userPrompt = `Hook: ${hook}\n\nTopic: ${topic}`;

  if (intention) {
    userPrompt += `\n\nContent Framework: ${intention}`;
  }

  // Add user profile context if available
  if (userProfile) {
    userPrompt += `\n\nUser Context: ${JSON.stringify(userProfile)}`;
  }

  try {
    const response = await generateChatCompletion(
      systemPrompt,
      userPrompt,
      'gpt-4o-mini',
      0.7
    );

    // Parse the JSON response
    const result = JSON.parse(response);

    if (!result.linkedin_post || !result.design_idea) {
      throw new Error('Invalid response format from AI');
    }

    return {
      linkedin_post: result.linkedin_post,
      design_idea: result.design_idea,
    };
  } catch (error: any) {
    console.error('Error generating post:', error.message);
    throw new Error(`Failed to generate post: ${error.message}`);
  }
};

/**
 * Recommend the best content framework/intention for a hook and topic
 * @param hook - The selected hook
 * @param topic - The original topic
 */
export const recommendIntention = async (
  hook: string,
  topic: string
): Promise<string> => {
  // Available frameworks
  const frameworks = [
    'Story → Insight → Shift',
    'Problem → Stakes → Solution',
    'Insight → Proof → Takeaway',
    'Identity Gap → Mirror → Reframe',
    'Contrarian Take → Explanation → New Rule',
    'Before → After → Lesson',
    'Claim → Evidence → Example',
    'List Format (3-5 punchy points)',
    'Fast Rant → Clarifier → Resolution'
  ];

  const systemPrompt = `You are a LinkedIn content strategist expert. Your task is to analyze a hook and topic, then recommend the BEST content framework from the provided list.

Consider:
- Which framework naturally fits the hook's style and tone
- What would create the most engaging and valuable post
- What structure would best deliver insights on the topic
- Professional LinkedIn audience expectations

Respond with ONLY the exact framework name from the list, nothing else.`;

  const userPrompt = `Hook: "${hook}"
Topic: "${topic}"

Available frameworks:
${frameworks.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Recommend the best framework:`;

  try {
    const response = await generateChatCompletion(
      systemPrompt,
      userPrompt,
      'gpt-4o-mini',
      0.3 // Low temperature for consistent recommendations
    );

    const intention = response.trim();

    // Validate that the response is one of our frameworks
    if (!frameworks.includes(intention)) {
      console.warn(`AI returned invalid framework: ${intention}. Using default.`);
      // Fallback to a versatile default
      return 'Problem → Stakes → Solution';
    }

    return intention;
  } catch (error: any) {
    console.error('Error recommending intention:', error.message);
    // Return a safe default instead of throwing
    return 'Problem → Stakes → Solution';
  }
};

/**
 * Get the LinkedIn user's URN (person ID) using the userinfo endpoint
 * This is needed to create posts as the authenticated user
 */
export const getLinkedInUserUrn = async (accessToken: string): Promise<string> => {
  try {
    // Use the OpenID Connect userinfo endpoint to get the user's sub (person ID)
    const response = await axios.get(`${LINKEDIN_API_BASE}/v2/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userInfo: LinkedInUserInfo = response.data;

    if (!userInfo.sub) {
      throw new Error('Could not retrieve LinkedIn user ID');
    }

    // Return the full person URN
    return `urn:li:person:${userInfo.sub}`;
  } catch (error: any) {
    console.error('Error getting LinkedIn user URN:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      throw new Error('LinkedIn access token is invalid or expired. Please sign in again.');
    }

    throw new Error(`Failed to get LinkedIn user info: ${error.message}`);
  }
};

/**
 * Publish a text post to LinkedIn using the Posts API
 *
 * LinkedIn Posts API (newer, recommended):
 * - Endpoint: POST https://api.linkedin.com/rest/posts
 * - Supports text-only posts for members
 * - Returns x-restli-id header with post URN
 */
export const publishToLinkedIn = async (
  accessToken: string,
  postText: string
): Promise<LinkedInPublishResult> => {
  try {
    // Step 1: Get the user's LinkedIn URN
    const authorUrn = await getLinkedInUserUrn(accessToken);
    console.log('Publishing as LinkedIn user:', authorUrn);

    // Step 2: Create the post using Posts API
    const postPayload = {
      author: authorUrn,
      commentary: postText,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    const response = await axios.post(`${LINKEDIN_API_BASE}/rest/posts`, postPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version':'202501'
      },
    });

    // The post ID is returned in the x-restli-id header
    const postId = response.headers['x-restli-id'];

    // Construct the post URL
    const postUrl = postId
      ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}`
      : undefined;

    console.log('LinkedIn post published successfully:', { postId, postUrl });

    return {
      success: true,
      postId: postId || undefined,
      postUrl,
    };
  } catch (error: any) {
    console.error('Error publishing to LinkedIn:', error.response?.data || error.message);

    const status = error.response?.status;
    const errorData = error.response?.data;

    if (status === 401) {
      return {
        success: false,
        error: 'LinkedIn access token is invalid or expired. Please sign in again.',
      };
    }

    if (status === 403) {
      return {
        success: false,
        error: 'You do not have permission to post to LinkedIn. Please check your app permissions.',
      };
    }

    if (status === 422) {
      return {
        success: false,
        error: errorData?.message || 'LinkedIn rejected the post. It may be duplicate content.',
      };
    }

    if (status === 429) {
      return {
        success: false,
        error: 'LinkedIn rate limit exceeded. Please wait a moment and try again.',
      };
    }

    return {
      success: false,
      error: errorData?.message || error.message || 'Failed to publish to LinkedIn',
    };
  }
};
