/**
 * LLM-backed helpers for the Avatar Builder.
 *
 * Kept narrow on purpose: the state machine handles all sequencing/copy.
 * These functions just decide "is this answer vague?", produce coach replies,
 * and (in synthesis) render the long narrative fields.
 */

import { generateChatCompletion } from './openaiService';
import {
  VAGUENESS_SCHEMA,
  CLIENT_PATTERNS_SCHEMA,
  NARRATIVES_SCHEMA,
} from './llmSchemas';

export interface VaguenessResult {
  ok: boolean;
  pushback?: string;
}

/**
 * Step-specific push-back copy lifted from the SKILL document.
 * Used when the LLM rubric says the answer is too vague.
 */
const PUSHBACK_BY_STEP: Record<string, string> = {
  '1.2A.1': `Hold up — that's too surface-level. I need the version that actually makes people feel something.

A specific answer sounds like: 'I was a financial advisor making six figures but every single client came from cold calling. I'd sit in my car before work dreading the calls. I knew there had to be a better way to get clients but I had no idea where to start with content.'

See how that has a specific situation, a specific emotion, and a specific gap? That's what we need.

Let's try again — what was ACTUALLY going on? Paint the picture for me.`,

  '1.2B.1': `Hold up — that's too vague. I need specifics because THIS is what makes your audience trust you.

A specific answer sounds like: 'I spent 6 years running paid media for a B2B SaaS agency. We managed $2M in ad spend across 40+ clients, and I saw the same mistakes killing campaigns over and over again.'

See the difference? Specifics = credibility. Let's try that again.`,

  '2.1': `Hold up — that could be literally anyone. We need to get WAY more specific.

Which SPECIFIC type? What industry? What size? What stage?

For example: 'B2B consultants in the finance space doing $200K-$500K revenue with a small team' — THAT'S a viewer. 'Business owners' is a platypus.

Let's narrow it down.`,

  '2.15': `Hold up — I need more specifics on this. Generic answers like 'they do their research' or 'they're careful with money' aren't enough to work with.

I need the *how* and the *why behind the how*. For example: 'She won't pitch a vendor spend to her CMO unless she's personally confident it'll work — because she's been the person who championed something that flopped before.' Or: 'She'll ask in a Slack community before she books a call, and Google you to see whether your clients look like real people.'

Let's try again.`,

  '2.35': `Hold up — that's still too abstract. I need the scene, not the summary.

Think about it like a movie frame: where are they physically? What did they just see, hear, or read? Who else is in the room or on the message thread?

What's the actual scene for your viewer?`,

  '2.36': `That's still a bit abstract. I need the texture — the specific tasks, the specific interruptions, the specific moment where they realize the day got away from them again.

Think about it like narrating their screen: what apps are open, what messages are piling up, what got pushed to tomorrow again?`,

  '4.5': `Hold up — that's a surface emotion. I need what's underneath.

Is it frustration because they've been right all along but keep having to prove it? Stress because they're doing the work and it's still not moving? Something else?

The flavor of the emotion is what determines what language lands in scripts and hooks. Give me the specific version — paint the picture of what you actually see when they walk into a conversation with you.`,

  '4.5c': `Hold up — that's too general. I need what you'd actually *notice* on a call.

A specific answer sounds like: 'He downplays the problem at first — says things like "we've been meaning to sort this out" instead of admitting it's been killing him for a year. The shift happens when I describe a specific situation he's been in and he goes quiet for a second, then says "yeah, that's exactly it."'

What do YOU actually see and hear? Give me the real version.`,

  '4.7': `Those are summaries, not phrases. I need the raw version — the words they'd actually type in a Slack message or say out loud on a call.

The difference is: 'they lack a consistent video strategy' vs. 'we keep starting and stopping and I don't know how to fix it.'

Go back to a real conversation or a real message — what did they literally say?`,

  '4.8': `That's a format, not an angle. I need to know what specifically stops them — not just the format but the topic, the hook, the emotional trigger.

For example: not 'educational content' but 'posts that name a specific failure story and end with a framework she can steal' — or 'anything that names the invisible political problem she can't say out loud in a meeting.'

Think about the last time a piece of content made your viewer say 'this is exactly me' — what was it about?`,
};

/**
 * Run the vagueness rubric for a given step. Returns ok=false with the SKILL
 * push-back copy when the answer is too generic, vague, or surface-level.
 *
 * Cheap and lenient by design: we only want to catch obviously empty answers
 * (one-liners, "I don't know", marketing-speak summaries). Substantive answers
 * — even imperfect ones — should pass.
 */
export const runVaguenessCheck = async (
  stepId: string,
  answer: string
): Promise<VaguenessResult> => {
  const trimmed = answer.trim();
  // Cheap pre-check: anything under ~30 chars is almost certainly too thin.
  if (trimmed.length < 30) {
    return { ok: false, pushback: PUSHBACK_BY_STEP[stepId] ?? defaultPushback() };
  }

  const systemPrompt = `You are a strict editor evaluating one user answer in a video-avatar coaching flow.
Return ONLY a single JSON object: {"ok": true} OR {"ok": false}.
ok=false means the answer is too generic, abstract, surface-level, marketing-speak, or under-specific to be useful.
ok=true means the answer has enough concrete detail (a specific situation, named industry, specific behaviour, real quote, etc.) to move on. Be lenient — only fail clearly vague answers.`;

  const userPrompt = `Step: ${stepId}
Answer:
"""
${trimmed}
"""

Return JSON only.`;

  try {
    const raw = await generateChatCompletion(systemPrompt, userPrompt, undefined, 0, {
      jsonSchema: VAGUENESS_SCHEMA,
    });
    const parsed = JSON.parse(raw);
    if (parsed && parsed.ok === true) return { ok: true };
    return { ok: false, pushback: PUSHBACK_BY_STEP[stepId] ?? defaultPushback() };
  } catch (err: any) {
    console.warn(`Vagueness check failed for ${stepId} (non-fatal):`, err.message);
    // Fail open: don't block the user if the LLM call breaks.
    return { ok: true };
  }
};

const defaultPushback = () =>
  `Hold up — that's a bit too thin to work with. Give me a bit more specific detail and we'll keep going.`;

/**
 * Coach mode: triggered when the user types 'help' on any step.
 * Returns a short, encouraging, step-aware nudge.
 */
export const runCoachMode = async (
  stepId: string,
  currentPrompt: string,
  answersSoFar: Record<string, any>
): Promise<string> => {
  const systemPrompt = `You are a warm, direct coach helping someone build their video viewer avatar. The user just typed "help" and needs unblocking on the current question.

Style:
- Be encouraging but direct. No fluff, no corporate speak.
- Give ONE concrete example tailored to what you know about them so far.
- 3-5 sentences max. End by inviting them to take a shot at the answer.
- Do NOT restate the entire question — they can already see it.
- Do NOT use emojis.`;

  const userPrompt = `Current step: ${stepId}
Current question prompt (for context, do not repeat verbatim):
"""
${currentPrompt}
"""

What we know about them so far (JSON of prior answers):
${JSON.stringify(answersSoFar, null, 2)}

Write a short coach reply to help them get unstuck on this step.`;

  try {
    return await generateChatCompletion(systemPrompt, userPrompt, undefined, 0.7);
  } catch (err: any) {
    console.warn('Coach mode failed (non-fatal):', err.message);
    return `No worries — take a beat and answer in your own words. Even a rough first draft is fine; we'll refine it together.`;
  }
};

/**
 * Synthesize common patterns from pasted client data (Step 2.0 done).
 */
export interface ClientPatterns {
  why_they_bought: string[];
  what_they_tried: string[];
  fears: string[];
  limiting_beliefs: string[];
  success_looks_like: string[];
  anti_identity_signals: string[];
  who_they_trust: string[];
}

export const synthesizeClientPatterns = async (
  submissions: string[]
): Promise<{ patterns: ClientPatterns; summaryMessage: string }> => {
  const systemPrompt = `You are analysing real client data (onboarding forms, sales call transcripts, survey responses) to extract patterns for an ideal-customer avatar.

Return ONLY a JSON object with this exact shape:
{
  "why_they_bought": [],
  "what_they_tried": [],
  "fears": [],
  "limiting_beliefs": [],
  "success_looks_like": [],
  "anti_identity_signals": [],
  "who_they_trust": []
}
Each array contains 3-6 short bullet-point strings. Use the clients' own language wherever possible (verbatim quotes are great). Do NOT invent details that aren't in the source.`;

  const userPrompt = `Client data submissions (${submissions.length} total):

${submissions.map((s, i) => `--- Submission ${i + 1} ---\n${s}`).join('\n\n')}

Extract the patterns as JSON.`;

  try {
    const raw = await generateChatCompletion(systemPrompt, userPrompt, undefined, 0.3, {
      jsonSchema: CLIENT_PATTERNS_SCHEMA,
    });
    const patterns = JSON.parse(raw) as ClientPatterns;
    const summaryMessage = renderPatternsSummary(patterns);
    return { patterns, summaryMessage };
  } catch (err: any) {
    console.warn('Pattern synthesis failed (non-fatal):', err.message);
    return {
      patterns: {
        why_they_bought: [],
        what_they_tried: [],
        fears: [],
        limiting_beliefs: [],
        success_looks_like: [],
        anti_identity_signals: [],
        who_they_trust: [],
      },
      summaryMessage: `Got it — I've saved the data you pasted and will weave it into the final avatar.`,
    };
  }
};

const renderPatternsSummary = (p: ClientPatterns): string => {
  const block = (title: string, items: string[]) =>
    items.length ? `\n**${title}:**\n${items.map((i) => `• ${i}`).join('\n')}` : '';

  return `Here's what I'm seeing across the board:
${block('Why they bought (the trigger)', p.why_they_bought)}
${block('What they\'ve tried that failed', p.what_they_tried)}
${block('Their fears and hesitations', p.fears)}
${block('What they believe (that\'s holding them back)', p.limiting_beliefs)}
${block('What success looks like to them', p.success_looks_like)}
${block('Anti-identity signals', p.anti_identity_signals)}
${block('Who they trust / follow', p.who_they_trust)}

I'll weave these patterns into the final avatar.`.trim();
};

/**
 * Final synthesis: produce a short narrative backstory + viewer summary string
 * from the raw answers. The full markdown is assembled deterministically in
 * avatarSynthesisService; only these two free-text fields use the LLM.
 */
export interface SynthesizedNarratives {
  backstory: string;
  viewerSummary: string;
}

export const synthesizeNarratives = async (
  answers: Record<string, any>,
  path: 'A' | 'B'
): Promise<SynthesizedNarratives> => {
  const systemPrompt = `You are writing two short narrative paragraphs for a Video Avatar document.

Hard rules:
- Use ONLY the facts in the user's answers. Do not invent details, names, numbers, or psychographics.
- Conversational, warm, direct. No corporate speak. No emojis.
- 3-4 sentences per paragraph, max.

Return ONLY a JSON object: {"backstory": "...", "viewer_summary": "..."}`;

  const userPrompt = `Path: ${path === 'A' ? 'Personal transformation (Path A)' : 'Insider expertise (Path B)'}

All answers (JSON):
${JSON.stringify(answers, null, 2)}

Write:
1. backstory — the user's own story (struggle/expertise → turning point → result → client proof).
2. viewer_summary — a single-paragraph portrait of the viewer pulling in demographics, journey stage, the micro moment, and their core limiting belief.`;

  try {
    const raw = await generateChatCompletion(systemPrompt, userPrompt, undefined, 0.4, {
      jsonSchema: NARRATIVES_SCHEMA,
    });
    const parsed = JSON.parse(raw);
    return {
      backstory: typeof parsed.backstory === 'string' ? parsed.backstory.trim() : '',
      viewerSummary: typeof parsed.viewer_summary === 'string' ? parsed.viewer_summary.trim() : '',
    };
  } catch (err: any) {
    console.warn('Narrative synthesis failed (non-fatal):', err.message);
    return { backstory: '', viewerSummary: '' };
  }
};
