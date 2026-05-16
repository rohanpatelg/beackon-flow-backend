/**
 * JSON Schemas for structured-output call sites.
 *
 * Passed to the Claude adapter as `output_config.format` so responses are
 * guaranteed to match the shape; ignored on the OpenAI path (those call
 * sites already parse free-form JSON from the prompt).
 *
 * Claude structured-outputs requires:
 *   - `additionalProperties: false` on every object
 *   - explicit `required` arrays listing all properties
 *   - no `minLength` / `maxLength` / `minimum` / `maximum` (silently dropped)
 */

const POST_SECTION_FIELDS = {
  intro: { type: 'string' },
  main_insight: { type: 'string' },
  supporting_detail: { type: 'string' },
  shift_takeaway: { type: 'string' },
  cta: { type: 'string' },
} as const;

const POST_SECTION_KEYS = Object.keys(POST_SECTION_FIELDS);

/** linkedinService.generateHooksFromTopic — array of hook strings. */
export const HOOKS_SCHEMA = {
  type: 'array',
  items: { type: 'string' },
} as const;

/** linkedinService.generatePostFromHook (4A base generation) — sections + design idea. */
export const POST_GENERATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ...POST_SECTION_FIELDS,
    design_idea: { type: 'string' },
  },
  required: [...POST_SECTION_KEYS, 'design_idea'],
} as const;

/** linkedinService.refinePostVoice / refinePostLogic — sections only. */
export const POST_SECTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: POST_SECTION_FIELDS,
  required: POST_SECTION_KEYS,
} as const;

/** linkedinService.generateTopicSuggestions — array of {topic, angle}. */
export const TOPIC_SUGGESTIONS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      topic: { type: 'string' },
      angle: { type: 'string' },
    },
    required: ['topic', 'angle'],
  },
} as const;

/** avatarPromptsService.runVaguenessCheck — {ok: bool}. */
export const VAGUENESS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
  },
  required: ['ok'],
} as const;

/** avatarPromptsService.synthesizeClientPatterns — pattern buckets. */
export const CLIENT_PATTERNS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    why_they_bought: { type: 'array', items: { type: 'string' } },
    what_they_tried: { type: 'array', items: { type: 'string' } },
    fears: { type: 'array', items: { type: 'string' } },
    limiting_beliefs: { type: 'array', items: { type: 'string' } },
    success_looks_like: { type: 'array', items: { type: 'string' } },
    anti_identity_signals: { type: 'array', items: { type: 'string' } },
    who_they_trust: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'why_they_bought',
    'what_they_tried',
    'fears',
    'limiting_beliefs',
    'success_looks_like',
    'anti_identity_signals',
    'who_they_trust',
  ],
} as const;

/** avatarPromptsService.synthesizeNarratives — backstory + viewer_summary. */
export const NARRATIVES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    backstory: { type: 'string' },
    viewer_summary: { type: 'string' },
  },
  required: ['backstory', 'viewer_summary'],
} as const;
