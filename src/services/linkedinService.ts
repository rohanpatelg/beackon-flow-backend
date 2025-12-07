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
 * Post sections structure for structured post generation
 */
export interface PostSections {
  intro: string;
  main_insight: string;
  supporting_detail: string;
  shift_takeaway: string;
  cta: string;
}

/**
 * Generate LinkedIn post content from a hook using AI
 * Returns structured sections for granular editing
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
): Promise<{ sections: PostSections; design_idea: string }> => {
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
Structure your post sections using this pattern: ${frameworkInstructions[intention]}`
    : '';

  const systemPrompt = `You are an expert LinkedIn content creator who writes engaging, professional posts.

Your task is to create LinkedIn post content in STRUCTURED SECTIONS based on the given hook and topic.${frameworkGuidance}

The hook is already provided and will be used as-is. You need to generate the remaining sections that flow naturally from the hook.

Guidelines for each section:
- intro: Introduction that connects to the hook and sets up the problem/context (1-2 sentences)
- main_insight: The core insight, main point, or key message (2-3 sentences)
- supporting_detail: Evidence, proof, example, visualization description, or quote that supports the main insight (2-3 sentences)
- shift_takeaway: A perspective shift or key takeaway for the reader (1-2 sentences)
- cta: A call-to-action or engaging question to encourage comments (1 sentence)

Overall guidelines:
- Each section should flow naturally into the next
- Use professional yet conversational tone
- Include relevant emojis sparingly (1-2 total across all sections)
- Keep total content under 1000 characters (hook adds ~200 more)
${intention ? `- Structure the content following the "${intention}" framework pattern` : ''}

Guidelines for design idea:
- Suggest a simple visual or graphic idea that complements the post
- Keep it practical and easy to create

Return ONLY a JSON object with this exact format:
{
  "intro": "Introduction/problem statement here...",
  "main_insight": "Core insight or main point here...",
  "supporting_detail": "Evidence, proof, or example here...",
  "shift_takeaway": "Key takeaway or perspective shift here...",
  "cta": "Call-to-action or question here...",
  "design_idea": "Description of visual/design suggestion here"
}`;

  let userPrompt = `Hook (will be used as-is at the start of the post): "${hook}"

Topic: ${topic}`;

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

    if (!result.intro || !result.main_insight || !result.supporting_detail || !result.shift_takeaway || !result.cta || !result.design_idea) {
      throw new Error('Invalid response format from AI - missing required sections');
    }

    return {
      sections: {
        intro: result.intro,
        main_insight: result.main_insight,
        supporting_detail: result.supporting_detail,
        shift_takeaway: result.shift_takeaway,
        cta: result.cta,
      },
      design_idea: result.design_idea,
    };
  } catch (error: any) {
    console.error('Error generating post:', error.message);
    throw new Error(`Failed to generate post: ${error.message}`);
  }
};

/**
 * Section key type for regeneration
 */
export type SectionKey = keyof PostSections;

/**
 * Section descriptions for context-aware regeneration
 */
const SECTION_DESCRIPTIONS: Record<SectionKey, string> = {
  intro: 'Introduction that connects to the hook and sets up the problem/context (1-2 sentences)',
  main_insight: 'The core insight, main point, or key message (2-3 sentences)',
  supporting_detail: 'Evidence, proof, example, visualization description, or quote that supports the main insight (2-3 sentences)',
  shift_takeaway: 'A perspective shift or key takeaway for the reader (1-2 sentences)',
  cta: 'A call-to-action or engaging question to encourage comments (1 sentence)',
};

/**
 * Regenerate a specific section of the post while maintaining context
 * @param sectionKey - Which section to regenerate
 * @param hook - The post hook
 * @param topic - The original topic
 * @param currentSections - All current sections for context
 * @param intention - Optional content framework
 */
export const regenerateSection = async (
  sectionKey: SectionKey,
  hook: string,
  topic: string,
  currentSections: PostSections,
  intention?: string
): Promise<string> => {
  const sectionDescription = SECTION_DESCRIPTIONS[sectionKey];

  const systemPrompt = `You are an expert LinkedIn content creator. Your task is to regenerate ONE specific section of a LinkedIn post while keeping it coherent with the other sections.

You are regenerating the "${sectionKey}" section.

Section requirements:
${sectionDescription}

Guidelines:
- Make it different from the current version but maintain coherence with the rest of the post
- Use professional yet conversational tone
- Keep the same general message but express it differently
- You may add 1 emoji if appropriate
- Ensure it flows naturally with the sections before and after it

Return ONLY the new section text, nothing else. No quotes, no labels, just the text.`;

  let userPrompt = `Topic: ${topic}
${intention ? `Content Framework: ${intention}` : ''}

Current post structure:
---
HOOK: ${hook}

INTRO: ${currentSections.intro}

MAIN INSIGHT: ${currentSections.main_insight}

SUPPORTING DETAIL: ${currentSections.supporting_detail}

TAKEAWAY: ${currentSections.shift_takeaway}

CTA: ${currentSections.cta}
---

Please generate a NEW version of the "${sectionKey}" section that is different from the current one but flows well with the other sections.`;

  try {
    const response = await generateChatCompletion(
      systemPrompt,
      userPrompt,
      'gpt-4o-mini',
      0.9 // Higher temperature for variety
    );

    return response.trim();
  } catch (error: any) {
    console.error('Error regenerating section:', error.message);
    throw new Error(`Failed to regenerate section: ${error.message}`);
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
