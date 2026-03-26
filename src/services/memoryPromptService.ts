import { GenerationContext } from '@/types';

const formatList = (items: string[]): string => (items.length > 0 ? items.join(', ') : 'None');

export const buildHookMemoryPrompt = (context: GenerationContext): string => {
  const sections: string[] = [];

  sections.push(`IMPORTANT: The context below is for REFERENCE ONLY. Use it to understand the founder's general direction and themes — NOT as a template. Every new post must feel fresh and original. Do NOT use emojis anywhere in the output.`);

  if (context.preferences) {
    sections.push(`Founder preferences:
- Preferred tone: ${context.preferences.preferredTone || 'Not specified'}
- Target audience: ${context.preferences.targetAudience || 'Not specified'}
- Preferred formats: ${formatList(context.preferences.preferredFormats)}
- CTA preference: ${context.preferences.ctaPreference || 'Not specified'}
- Forbidden phrases: ${formatList(context.preferences.forbiddenPhrases)}
- Hard constraints: ${formatList(context.preferences.hardConstraints)}`);
  }

  if (context.styleProfile) {
    sections.push(`Writing style reference (inferred from past posts — use as a loose signal, not a rulebook):
- Common themes: ${formatList(context.styleProfile.commonThemes)}`);
  }

  if (context.memories.length > 0) {
    sections.push(`Related past posts (for awareness of what was already covered — do NOT repeat or closely imitate):
${context.memories
  .map(
    (memory, index) =>
      `${index + 1}. ${memory.summary}`
  )
  .join('\n')}`);
  }

  return sections.join('\n\n');
};

export const buildPostMemoryPrompt = (context: GenerationContext): string => {
  const base = buildHookMemoryPrompt(context);
  if (!base) {
    return '';
  }

  return `${base}

Use these references to stay aware of the founder's direction. Do NOT mimic prior posts — generate something genuinely new.`;
};

export const buildSuggestionMemoryPrompt = (context: GenerationContext): string => {
  const base = buildHookMemoryPrompt(context);
  if (!base) {
    return '';
  }

  return `${base}

Use the memory above to suggest adjacent post ideas, not duplicates of prior posts.`;
};
