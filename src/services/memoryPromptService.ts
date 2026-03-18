import { GenerationContext } from '@/types';

const formatList = (items: string[]): string => (items.length > 0 ? items.join(', ') : 'None');

export const buildHookMemoryPrompt = (context: GenerationContext): string => {
  const sections: string[] = [];

  if (context.preferences) {
    sections.push(`Explicit founder preferences:
- Preferred tone: ${context.preferences.preferredTone || 'Not specified'}
- Target audience: ${context.preferences.targetAudience || 'Not specified'}
- Preferred formats: ${formatList(context.preferences.preferredFormats)}
- CTA preference: ${context.preferences.ctaPreference || 'Not specified'}
- Emoji preference: ${context.preferences.emojiPreference || 'Not specified'}
- Forbidden phrases: ${formatList(context.preferences.forbiddenPhrases)}
- Hard constraints: ${formatList(context.preferences.hardConstraints)}`);
  }

  if (context.styleProfile) {
    sections.push(`Inferred writing style profile:
${context.styleProfile.summary}
- Tone tendencies: ${formatList(context.styleProfile.tone)}
- Common themes: ${formatList(context.styleProfile.commonThemes)}`);
  }

  if (context.memories.length > 0) {
    sections.push(`Relevant past post memories:
${context.memories
  .map(
    (memory, index) =>
      `${index + 1}. ${memory.summary} (${memory.matchReason}, ${memory.similarityBand} similarity)`
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

Use this memory to preserve the founder's voice, preferred pacing, format habits, and CTA style. Never copy prior posts verbatim.`;
};

export const buildSuggestionMemoryPrompt = (context: GenerationContext): string => {
  const base = buildHookMemoryPrompt(context);
  if (!base) {
    return '';
  }

  return `${base}

Use the memory above to suggest adjacent post ideas, not duplicates of prior posts.`;
};
