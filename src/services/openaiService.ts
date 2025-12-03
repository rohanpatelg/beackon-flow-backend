import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

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
 * @param model - OpenAI model to use (default: gpt-4o-mini)
 * @param temperature - Creativity level 0-2 (default: 0.7)
 */
export const generateChatCompletion = async (
  systemPrompt: string,
  userPrompt: string,
  model: string = 'gpt-4o-mini',
  temperature: number = 0.7
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
      temperature: temperature,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;

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
