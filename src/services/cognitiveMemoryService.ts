import { getPgvectorExtensionStatus, getPostMemoriesByDeviceFromDb, getPostMemoryCountsFromDb, getStyleProfileByDeviceFromDb, querySimilarMemoriesWithVectorFromDb, upsertPostMemoryInDb, upsertStyleProfileInDb } from '@/repositories/cognitiveRepository';
import { fetchUserAnswersFromDb } from '@/repositories/onboardingRepository';
import { fetchAllUserPostsByDeviceFromDb, UserPostSummary } from '@/repositories/postsRepository';
import { generateEmbedding } from '@/services/openaiService';
import { getUserPreferences, hasExplicitPreferences } from '@/services/preferenceService';
import { GenerationContext, RetrievedMemory, StyleProfile } from '@/types';

const COGNITION_TOP_K = parseInt(process.env.COGNITION_TOP_K || '2', 10);
const COGNITION_MIN_SIMILARITY = parseFloat(process.env.COGNITION_MIN_SIMILARITY || '0.76');
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'being', 'between', 'could', 'every', 'founder', 'from', 'have', 'just',
  'like', 'more', 'only', 'over', 'same', 'some', 'such', 'than', 'that', 'their', 'there', 'these',
  'they', 'this', 'what', 'when', 'where', 'which', 'while', 'with', 'your', 'into', 'because',
]);

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const stripEmoji = (value: string): boolean => /\p{Extended_Pictographic}/u.test(value);

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));

const getTopThemes = (texts: string[], limit: number = 8): string[] => {
  const scores = new Map<string, number>();

  texts.forEach((text) => {
    tokenize(text).forEach((token) => {
      scores.set(token, (scores.get(token) || 0) + 1);
    });
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
};

const detectFormat = (text: string): string => {
  if (/\b1[\).\s]/.test(text) || /\b2[\).\s]/.test(text)) {
    return 'list';
  }

  const paragraphCount = text.split(/\n\s*\n/).filter(Boolean).length;
  if (paragraphCount >= 4) {
    return 'story';
  }

  return 'paragraph';
};

const detectIntent = (post: UserPostSummary): string => {
  if (post.intention) {
    return post.intention;
  }

  const source = `${post.hook || ''} ${post.topic || ''} ${post.post || ''}`.toLowerCase();
  if (source.includes('?')) {
    return 'question-led';
  }
  if (/\b(before|after|lesson)\b/.test(source)) {
    return 'transformation';
  }
  if (/\b(problem|stakes|solution)\b/.test(source)) {
    return 'problem-solution';
  }
  if (/\bstory|experience|learned\b/.test(source)) {
    return 'story-insight';
  }
  return 'thought-leadership';
};

const buildMemoryText = (post: UserPostSummary): string => {
  const sections = [
    post.topic ? `Topic: ${post.topic}` : '',
    post.hook ? `Hook: ${post.hook}` : '',
    post.intention ? `Framework: ${post.intention}` : '',
    post.post ? `Post: ${post.post}` : '',
  ].filter(Boolean);

  return normalizeWhitespace(sections.join('\n'));
};

const summarizePost = (post: UserPostSummary): string => {
  const lead = post.topic || post.hook || 'Founder post';
  const body = normalizeWhitespace(post.post || '').slice(0, 180);
  return body ? `${lead}: ${body}` : lead;
};

const analyzeStyleSignals = (post: UserPostSummary) => {
  const text = post.post || '';
  const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  const words = text.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const questionCount = (text.match(/\?/g) || []).length;
  const exclamationCount = (text.match(/!/g) || []).length;
  const emojiMatches = text.match(/\p{Extended_Pictographic}/gu);
  const emojiCount = emojiMatches ? emojiMatches.length : 0;
  const lineBreakCount = (text.match(/\n/g) || []).length;

  return {
    avgSentenceLength: sentences.length > 0 ? Number((words.length / sentences.length).toFixed(2)) : 0,
    totalWords: words.length,
    questionCount,
    exclamationCount,
    emojiCount,
    lineBreakCount,
    format: detectFormat(text),
    hasQuestionCta: /\?\s*$/.test(text.trim()),
    hookStyle: post.hook && post.hook.includes('?') ? 'question' : 'statement',
  };
};

const similarityBand = (score: number): 'high' | 'medium' | 'low' => {
  if (score >= 0.88) return 'high';
  if (score >= 0.76) return 'medium';
  return 'low';
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const safeNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number')
    : [];

const buildWhyRelevant = (intent: string, topic: string | null): string =>
  topic ? `Similar founder post about ${topic} with intent ${intent}` : `Similar founder post intent: ${intent}`;

const buildToneLabels = (posts: UserPostSummary[], onboardingText: string): string[] => {
  const allText = posts.map((post) => post.post || '').join('\n');
  const labels: string[] = [];

  if (allText.includes('?')) {
    labels.push('conversational');
  }
  if ((allText.match(/\n/g) || []).length > posts.length * 2) {
    labels.push('skimmable');
  }
  if ((allText.match(/!/g) || []).length > posts.length) {
    labels.push('energetic');
  }
  if (!stripEmoji(allText)) {
    labels.push('clean, no-emoji style');
  }
  if (/\bstory|experience|journey\b/i.test(onboardingText)) {
    labels.push('story-driven');
  }

  return [...new Set(labels)];
};

const buildStyleSummary = (
  posts: UserPostSummary[],
  commonThemes: string[],
  tone: string[],
  onboardingText: string
): string => {
  if (posts.length === 0) {
    return onboardingText
      ? `Founder preference context available from onboarding: ${normalizeWhitespace(onboardingText).slice(0, 220)}`
      : 'No established style profile yet.';
  }

  const wordCounts = posts.map((post) => (post.post || '').split(/\s+/).filter(Boolean).length);
  const avgWords = Math.round(wordCounts.reduce((sum, count) => sum + count, 0) / Math.max(wordCounts.length, 1));
  const formats = posts.map((post) => detectFormat(post.post || ''));
  const dominantFormat = formats.sort((a, b) =>
    formats.filter((value) => value === b).length - formats.filter((value) => value === a).length
  )[0];

  const audienceHint = onboardingText ? ` Onboarding context: ${normalizeWhitespace(onboardingText).slice(0, 160)}.` : '';

  return `The founder usually writes ${tone.join(', ')} LinkedIn posts around ${avgWords} words, commonly using ${dominantFormat} structure. Frequent themes include ${commonThemes.slice(0, 5).join(', ') || 'general founder lessons'}.${audienceHint}`;
};

const computeStyleProfile = (deviceId: string, posts: UserPostSummary[], onboardingText: string): StyleProfile & { sampleCounts: Record<string, unknown> } => {
  const commonThemes = getTopThemes(
    posts.flatMap((post) => [post.topic || '', post.hook || '', post.post || '']).filter(Boolean),
    10
  );
  const tone = buildToneLabels(posts, onboardingText);
  const formatCounts = posts.reduce<Record<string, number>>((acc, post) => {
    const format = detectFormat(post.post || '');
    acc[format] = (acc[format] || 0) + 1;
    return acc;
  }, {});
  const ctaQuestionRate =
    posts.length === 0
      ? 0
      : Number(
          (
            posts.filter((post) => /\?\s*$/.test((post.post || '').trim())).length / posts.length
          ).toFixed(2)
        );

  return {
    deviceId,
    summary: buildStyleSummary(posts, commonThemes, tone, onboardingText),
    tone,
    structureHabits: {
      averageParagraphs:
        posts.length === 0
          ? 0
          : Number(
              (
                posts
                  .map((post) => (post.post || '').split(/\n\s*\n/).filter(Boolean).length)
                  .reduce((sum, value) => sum + value, 0) / posts.length
              ).toFixed(2)
            ),
    },
    ctaHabits: {
      questionRate: ctaQuestionRate,
      dominantCta: ctaQuestionRate >= 0.5 ? 'question' : 'statement',
    },
    formatHabits: formatCounts,
    commonThemes,
    confidence: Number(Math.min(1, posts.length / 8 + (onboardingText ? 0.15 : 0)).toFixed(2)),
    sampleCounts: {
      posts: posts.length,
      publishedPosts: posts.filter((post) => post.status === 2).length,
      onboardingIncluded: Boolean(onboardingText),
    },
  };
};

const toRetrievedMemory = (row: any, score: number): RetrievedMemory => ({
  postId: row.post_id || undefined,
  topic: row.topic || null,
  summary: row.summary,
  similarity: Number(score.toFixed(4)),
  whyRelevant: buildWhyRelevant(row.inferred_intent || 'general', row.topic || null),
  matchReason: row.inferred_intent || 'semantic similarity',
  similarityBand: similarityBand(score),
});

export const syncPostMemoryForPost = async (post: UserPostSummary): Promise<void> => {
  const memoryText = buildMemoryText(post);
  const summary = summarizePost(post);
  const intent = detectIntent(post);
  const themes = getTopThemes([post.topic || '', post.hook || '', post.post || '']);
  const styleSignals = analyzeStyleSignals(post);

  let embedding: number[] | null = null;
  let embeddingState: 'ready' | 'failed' = 'ready';
  let syncStatus = 'indexed';
  let lastError: string | null = null;

  try {
    embedding = await generateEmbedding(memoryText);
  } catch (error: any) {
    embeddingState = 'failed';
    syncStatus = 'embedding_failed';
    lastError = error.message || 'Embedding generation failed';
  }

  await upsertPostMemoryInDb({
    deviceId: post.device_id,
    postId: post.id,
    sourceType: 'post',
    sourceStatus: post.status === 2 ? 'published' : post.status === 1 ? 'draft' : 'unknown',
    text: memoryText,
    summary,
    intent,
    themes,
    styleSignals,
    embeddingState,
    vectorDocumentId: `${post.device_id}:${post.id}`,
    syncStatus,
    syncVersion: 1,
    embedding,
    topic: post.topic || null,
    lastError,
  });
};

export const recomputeStyleProfileForDevice = async (deviceId: string): Promise<StyleProfile> => {
  const [posts, answers] = await Promise.all([
    fetchAllUserPostsByDeviceFromDb(deviceId),
    fetchUserAnswersFromDb(deviceId),
  ]);

  const onboardingText = [answers?.answer_1 || '', answers?.answer_2 || ''].filter(Boolean).join('\n');
  const profile = computeStyleProfile(deviceId, posts, onboardingText);
  return upsertStyleProfileInDb(profile);
};

const fallbackSimilaritySearch = async (
  deviceId: string,
  queryEmbedding: number[],
  limit: number,
  excludePostId?: number
): Promise<RetrievedMemory[]> => {
  const memories = await getPostMemoriesByDeviceFromDb(deviceId);
  return memories
    .filter((memory) => memory.embedding_json && (!excludePostId || memory.post_id !== excludePostId))
    .map((memory) => ({
      row: memory,
      score: cosineSimilarity(queryEmbedding, safeNumberArray(memory.embedding_json)),
    }))
    .filter((entry) => entry.score >= COGNITION_MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => toRetrievedMemory(entry.row, entry.score));
};

export const getGenerationContextForDevice = async (
  deviceId: string,
  queryText: string,
  options?: { excludePostId?: number; limit?: number }
): Promise<GenerationContext> => {
  const [styleProfile, preferences] = await Promise.all([
    getStyleProfileByDeviceFromDb(deviceId),
    getUserPreferences(deviceId),
  ]);

  let memories: RetrievedMemory[] = [];

  try {
    const queryEmbedding = await generateEmbedding(queryText);
    try {
      memories = await querySimilarMemoriesWithVectorFromDb(
        deviceId,
        queryEmbedding,
        options?.limit || COGNITION_TOP_K,
        options?.excludePostId
      );
    } catch {
      memories = await fallbackSimilaritySearch(
        deviceId,
        queryEmbedding,
        options?.limit || COGNITION_TOP_K,
        options?.excludePostId
      );
    }
  } catch {
    memories = [];
  }

  // Filter out low-similarity memories — only keep relevant references
  memories = memories
    .filter((m) => m.similarity >= COGNITION_MIN_SIMILARITY)
    .slice(0, options?.limit || COGNITION_TOP_K);

  return {
    memories,
    styleProfile,
    preferences,
    styleApplied: Boolean(styleProfile),
    preferenceApplied: hasExplicitPreferences(preferences),
  };
};

export const rebuildCognitionForDevice = async (deviceId: string): Promise<{
  syncedPosts: number;
  styleProfile: StyleProfile;
}> => {
  const posts = await fetchAllUserPostsByDeviceFromDb(deviceId);
  for (const post of posts) {
    await syncPostMemoryForPost(post);
  }

  const styleProfile = await recomputeStyleProfileForDevice(deviceId);
  return {
    syncedPosts: posts.length,
    styleProfile,
  };
};

export const getCognitionStatusForDevice = async (deviceId: string): Promise<Record<string, unknown>> => {
  const [counts, styleProfile, preferences, extensionEnabled] = await Promise.all([
    getPostMemoryCountsFromDb(deviceId),
    getStyleProfileByDeviceFromDb(deviceId),
    getUserPreferences(deviceId),
    getPgvectorExtensionStatus().catch(() => false),
  ]);

  return {
    extensionEnabled,
    memoryCounts: counts,
    hasStyleProfile: Boolean(styleProfile),
    styleConfidence: styleProfile?.confidence || 0,
    hasExplicitPreferences: hasExplicitPreferences(preferences),
  };
};

export const getCognitionProfileForDevice = async (
  deviceId: string
): Promise<{ styleProfile: StyleProfile | null; preferences: Awaited<ReturnType<typeof getUserPreferences>> }> => {
  const [styleProfile, preferences] = await Promise.all([
    getStyleProfileByDeviceFromDb(deviceId),
    getUserPreferences(deviceId),
  ]);

  return {
    styleProfile,
    preferences,
  };
};
