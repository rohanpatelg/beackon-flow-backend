/**
 * Avatar synthesis: turn a completed session's `answers` + `client_data`
 * into a structured Avatar row and a rendered markdown document.
 *
 * Field mapping is deterministic. Only `backstory` and `viewer.summary`
 * are produced by an LLM (see avatarPromptsService.synthesizeNarratives).
 */

import { AvatarSession, UpsertAvatarInput } from '@/repositories/avatarRepository';
import { synthesizeNarratives, ClientPatterns } from './avatarPromptsService';

const JOURNEY_LABELS: Record<string, string> = {
  A: "Hasn't started yet",
  B: 'Started but stuck',
  C: 'Already doing it, wants to do it better',
};

const get = (answers: Record<string, any>, key: string): string => {
  const v = answers[key];
  return typeof v === 'string' ? v : '';
};

export const buildAvatarFromSession = async (
  session: AvatarSession
): Promise<UpsertAvatarInput> => {
  const a = session.answers || {};
  const path: 'A' | 'B' = get(a, '1.1').toUpperCase() === 'B' ? 'B' : 'A';

  const { backstory, viewerSummary } = await synthesizeNarratives(a, path);

  const journeyId = get(a, '2.2').toUpperCase();
  const journeyStage = JOURNEY_LABELS[journeyId] || journeyId || '';

  const wakeUpThought = get(a, '3.1');

  const viewer = {
    summary: viewerSummary,
    demographics: get(a, '2.1'),
    journey_stage_id: journeyId,
    journey_stage_label: journeyStage,
    tried_and_failed: get(a, '2.3'),
    micro_moment: get(a, '2.35'),
    daily_reality: get(a, '2.36'),
    limiting_beliefs: get(a, '2.4'),
  };

  const generational = {
    raw: get(a, '2.15'),
  };

  const brainWiring = {
    primary_emotion: get(a, '4.5'),
    chronic_acute_private_social: get(a, '4.5b'),
    how_it_shows_up: get(a, '4.5c'),
    defenses_drop: get(a, '4.6'),
    proof_format: get(a, '4.45'),
    messaging_tone: deriveMessagingTone(get(a, '4.5b')),
  };

  const drivers = {
    core_values: get(a, '4.1'),
    making_it: get(a, '4.2'),
  };

  const antiIdentity = {
    raw: get(a, '4.3'),
  };

  const heroes = splitToList(get(a, '4.4'));
  const vocPhrases = splitToList(get(a, '4.7'));
  const stopScroll = splitToList(get(a, '4.8'));

  const patterns: ClientPatterns | null = (session.patterns as ClientPatterns | null) || null;

  const markdown = renderMarkdown({
    wakeUpThought,
    backstory,
    path,
    viewer,
    generational,
    brainWiring,
    drivers,
    antiIdentity,
    heroes,
    vocPhrases,
    stopScroll,
    patterns,
  });

  return {
    device_id: session.device_id,
    session_id: session.id,
    wake_up_thought: wakeUpThought,
    backstory,
    viewer,
    generational,
    brain_wiring: brainWiring,
    drivers,
    anti_identity: antiIdentity,
    heroes,
    voc_phrases: vocPhrases,
    stop_scroll: stopScroll,
    patterns,
    markdown,
  };
};

/**
 * Best-effort tone derivation from the user's chronic/acute + private/social answer.
 * Falls back to a generic line if we can't parse the signal.
 */
const deriveMessagingTone = (raw: string): string => {
  const lower = raw.toLowerCase();
  const chronic = lower.includes('chronic') || (!lower.includes('acute') && /long|always|never goes away|grind/.test(lower));
  const social = lower.includes('social') || /front of|meetings|group|public|in front/.test(lower);
  if (chronic && !social) return 'Quiet, empathetic: "you don\'t have to keep carrying this."';
  if (chronic && social) return 'Validating, solidarity: "you\'re not the only one dealing with this."';
  if (!chronic && !social) return 'Hope-giving, action: "there\'s a way out of this specific situation."';
  if (!chronic && social) return 'Direct, urgency: "here\'s what to say next time it happens in front of others."';
  return 'Match the emotional flavor the user described above.';
};

/**
 * Splits multi-line / comma-separated free text into a clean list.
 * Used for heroes, VOC phrases, scroll-stoppers — all of which the SKILL
 * asks for as enumerated items but users will often paste as prose.
 */
const splitToList = (raw: string): string[] => {
  if (!raw || !raw.trim()) return [];
  // Prefer newline / bullet split if present; fall back to "1." / ";" / "," splits.
  const byLine = raw
    .split(/\n+|^\s*[-•*]\s+|^\s*\d+[.)]\s+/gm)
    .map((s) => s.replace(/^[-•*\s]+/, '').trim())
    .filter(Boolean);
  if (byLine.length >= 2) return byLine;
  return raw.split(/[;]+|,(?=\s)/).map((s) => s.trim()).filter(Boolean);
};

interface RenderInput {
  wakeUpThought: string;
  backstory: string;
  path: 'A' | 'B';
  viewer: any;
  generational: any;
  brainWiring: any;
  drivers: any;
  antiIdentity: any;
  heroes: string[];
  vocPhrases: string[];
  stopScroll: string[];
  patterns: ClientPatterns | null;
}

const renderMarkdown = (i: RenderInput): string => {
  const list = (items: string[]) =>
    items.length ? items.map((x) => `- ${x}`).join('\n') : '_(none provided)_';

  const patternsBlock = i.patterns
    ? `

---

## COMMON PATTERNS (From Real Client Data)

**Why they bought (the trigger):**
${list(i.patterns.why_they_bought || [])}

**What they've tried that failed:**
${list(i.patterns.what_they_tried || [])}

**Their fears and hesitations:**
${list(i.patterns.fears || [])}

**What they believe (that's holding them back):**
${list(i.patterns.limiting_beliefs || [])}

**What success looks like to them:**
${list(i.patterns.success_looks_like || [])}

**Their anti-identity signals:**
${list(i.patterns.anti_identity_signals || [])}

**Who they trust / follow:**
${list(i.patterns.who_they_trust || [])}`
    : '';

  return `# VIDEO AVATAR

## HOW TO USE THIS DOCUMENT

This is the target viewer avatar for all video content. It defines the ONE person every video should be made for.

**For AI tools:** When generating scripts, ideas, hooks, or outlines, calibrate to this avatar. The Wake-Up Thought below is the primary filter. If a piece of content doesn't connect back to it, flag it.

**For the creator:** Pin this document. Reference it before every video. If an idea doesn't serve this person, don't make it.

---

## THE WAKE-UP THOUGHT

> "${i.wakeUpThought}"

**This is your content compass.** Every video should connect back to this thought.

---

## YOUR BACKSTORY

${i.backstory || '_(not provided)_'}

---

## YOUR VIEWER

${i.viewer.summary || ''}

**Who they are:** ${i.viewer.demographics || ''}

**Journey stage:** ${i.viewer.journey_stage_label || ''}

**The micro moment:** ${i.viewer.micro_moment || ''}

**Their daily reality:** ${i.viewer.daily_reality || ''}

**What they've tried that failed:** ${i.viewer.tried_and_failed || ''}

**What they currently believe (that's wrong):** ${i.viewer.limiting_beliefs || ''}

---

## GENERATIONAL CONTEXT

${i.generational.raw || ''}

---

## BRAIN & WIRING

### Emotional Mapping

**Primary emotion:** ${i.brainWiring.primary_emotion || ''}

**Chronic/acute + private/social:** ${i.brainWiring.chronic_acute_private_social || ''}

**Messaging tone this creates:** ${i.brainWiring.messaging_tone || ''}

**How it shows up in conversations:** ${i.brainWiring.how_it_shows_up || ''}

### When The Defenses Drop

${i.brainWiring.defenses_drop || ''}

### Proof Format That Works On Them

${i.brainWiring.proof_format || ''}

---

## WHAT DRIVES THEM

**Core values:** ${i.drivers.core_values || ''}

**What "making it" means to them:** ${i.drivers.making_it || ''}

---

## WHAT REPELS THEM (Anti-Identity)

${i.antiIdentity.raw || ''}

**Content filter:** Your videos should NEVER look, sound, or feel like the things above.

---

## WHO THEY ALREADY TRUST (Heroes & Role Models)

${list(i.heroes)}

---

## VOICE OF CUSTOMER

**How they describe the problem (verbatim-style phrases):**

${list(i.vocPhrases)}

**How to use this:** These phrases are hook gold. Open a video or LinkedIn post with one and they'll stop mid-scroll. Mirror them back in discovery calls and watch the dynamic shift.

---

## WHAT MAKES THEM STOP SCROLLING

${list(i.stopScroll)}
${patternsBlock}
`;
};
