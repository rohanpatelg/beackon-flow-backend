/**
 * Unified front door for chat completions.
 *
 * Routes every call to either OpenAI or Anthropic based on `LLM_PROVIDER`
 * (default: openai). Embeddings stay on OpenAI and are NOT routed through
 * here — see openaiService.generateEmbedding.
 *
 * Adding a new provider: extend `Provider`, add a `call<Name>` adapter,
 * and route in `generateChatCompletion`. Each adapter is responsible for
 * stripping params the provider doesn't support (e.g. Claude Opus 4.7
 * rejects `temperature`, `top_p`, `top_k`, and `budget_tokens`).
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

type Provider = 'openai' | 'claude';

export interface LLMOptions {
  /**
   * Opt-in Claude adaptive thinking. Ignored on OpenAI.
   * Off by default to match OpenAI latency/cost parity.
   */
  thinking?: boolean;
  /**
   * JSON Schema for structured outputs.
   * - Claude: passed via `output_config.format`; response is guaranteed to match.
   * - OpenAI: ignored (existing call sites already prompt + JSON.parse).
   */
  jsonSchema?: Record<string, unknown>;
}

const OPEN_AI_MODEL = process.env.OPEN_AI_MODEL || 'gpt-5-2025-08-07';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
const ANTHROPIC_MAX_TOKENS = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '16000', 10);

const getProvider = (): Provider =>
  ((process.env.LLM_PROVIDER || 'openai').toLowerCase() as Provider);

// Lazy singletons so we don't construct clients we'll never use.
let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;

const getOpenAI = (): OpenAI => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

const getAnthropic = (): Anthropic => {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
};

/**
 * Generate a chat completion. Provider is chosen by `LLM_PROVIDER` env var.
 *
 * @param systemPrompt - System message
 * @param userPrompt   - User message
 * @param model        - OpenAI model override; IGNORED on Claude (uses ANTHROPIC_MODEL env)
 * @param temperature  - OpenAI sampling temperature; IGNORED on Claude (Opus 4.7 rejects it)
 * @param options      - Optional provider-specific knobs (thinking, jsonSchema)
 */
export const generateChatCompletion = async (
  systemPrompt: string,
  userPrompt: string,
  model: string = OPEN_AI_MODEL,
  temperature: number = 0.5,
  options?: LLMOptions,
): Promise<string> => {
  const provider = getProvider();
  return provider === 'claude'
    ? callClaude(systemPrompt, userPrompt, options)
    : callOpenAI(systemPrompt, userPrompt, model, temperature);
};

// ── OpenAI adapter ────────────────────────────────────────────────────────

const callOpenAI = async (
  systemPrompt: string,
  userPrompt: string,
  model: string,
  _temperature: number,
): Promise<string> => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  try {
    const response = await getOpenAI().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No content returned from OpenAI');
    return content.trim();
  } catch (error: any) {
    console.error('OpenAI API error:', error.message);
    throw new Error(`OpenAI completion failed: ${error.message}`);
  }
};

// ── Claude adapter ────────────────────────────────────────────────────────

const callClaude = async (
  systemPrompt: string,
  userPrompt: string,
  options?: LLMOptions,
): Promise<string> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  try {
    const params: any = {
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };
    if (options?.thinking) {
      params.thinking = { type: 'adaptive' };
    }
    if (options?.jsonSchema) {
      params.output_config = {
        format: { type: 'json_schema', schema: options.jsonSchema },
      };
    }

    const resp = await getAnthropic().messages.create(params);

    // Find the first text block in the response content.
    const textBlock = resp.content.find(
      (b: any) => b.type === 'text',
    ) as { type: 'text'; text: string } | undefined;

    if (!textBlock) {
      throw new Error('No text content returned from Claude');
    }
    return textBlock.text.trim();
  } catch (error: any) {
    console.error('Claude API error:', error.message);
    throw new Error(`Claude completion failed: ${error.message}`);
  }
};

/**
 * Surface the active provider for logging / status endpoints.
 */
export const getActiveProvider = (): Provider => getProvider();
