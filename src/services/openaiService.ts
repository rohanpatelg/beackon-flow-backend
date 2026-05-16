/**
 * OpenAI client owner. Hosts the embeddings call (which is OpenAI-only —
 * Anthropic has no embeddings API and pgvector storage depends on the
 * 1536-dim OpenAI vectors already in m_post_memories).
 *
 * Chat completions are routed through llmService — the export below is a
 * pass-through so existing call sites (`import { generateChatCompletion }
 * from './openaiService'`) keep working unchanged.
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

// Initialize OpenAI client (used here for embeddings; chat goes through llmService)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Re-export the unified chat completion. Existing imports keep working;
 * the actual provider (OpenAI or Claude) is decided inside llmService
 * based on LLM_PROVIDER env var.
 */
export { generateChatCompletion } from './llmService';

/**
 * Check if OpenAI is properly configured (still needed for embeddings).
 */
export const isOpenAIConfigured = (): boolean => {
  return !!process.env.OPENAI_API_KEY;
};

/**
 * Generate an embedding. Always uses OpenAI regardless of LLM_PROVIDER.
 */
export const generateEmbedding = async (input: string): Promise<number[]> => {
  try {
    if (!isOpenAIConfigured()) {
      throw new Error('OpenAI API key not configured (required for embeddings)');
    }

    const response = await openai.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error('No embedding returned from OpenAI');
    }

    return embedding;
  } catch (error: any) {
    console.error('OpenAI embedding error:', error.message);
    throw new Error(`OpenAI embedding failed: ${error.message}`);
  }
};

/**
 * Export the client for direct use if needed.
 */
export const openaiClient = openai;
