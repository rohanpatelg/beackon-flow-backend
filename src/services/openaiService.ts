import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const OPEN_AI_MODEL = process.env.OPEN_AI_MODEL || 'gpt-5-2025-08-07';
const OPENAI_MAX_TOKENS = process.env.OPENAI_MAX_TOKENS || 2000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Check if OpenAI is properly configured
 */
export const isOpenAIConfigured = (): boolean => {
  return !!process.env.OPENAI_API_KEY;
};

/**
 * Generate chat completion using OpenAI
 * @param systemPrompt - System message to set context
 * @param userPrompt - User message/question
 * @param model - OpenAI model to use (default: OPEN_AI_MODEL)
 * @param temperature - Creativity level 0-2 (default: 0.7)
 */
export const generateChatCompletion = async (
  systemPrompt: string,
  userPrompt: string,
  model: string = OPEN_AI_MODEL,
  temperature: number = 0.5
): Promise<string> => {
  try {
    if (!isOpenAIConfigured()) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
 
    });

    const content = response.choices[0]?.message?.content;
    console.log(response.choices[0]);

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    return content.trim();
  } catch (error: any) {
    console.error('OpenAI API error:', error.message);
    throw new Error(`OpenAI completion failed: ${error.message}`);
  }
};

/**
 * Export the client for direct use if needed
 */
export const openaiClient = openai;
