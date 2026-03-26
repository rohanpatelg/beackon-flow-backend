export type MemorySourceType = 'post' | 'onboarding';
export type MemorySourceStatus = 'draft' | 'published' | 'unknown';
export type EmbeddingState = 'pending' | 'ready' | 'failed';

export interface MemoryDocument {
  id?: number;
  deviceId: string;
  postId?: number;
  sourceType: MemorySourceType;
  sourceStatus: MemorySourceStatus;
  text: string;
  summary: string;
  intent: string;
  themes: string[];
  styleSignals: Record<string, unknown>;
  embeddingState: EmbeddingState;
}

export interface RetrievedMemory {
  postId?: number;
  topic?: string | null;
  summary: string;
  similarity: number;
  whyRelevant: string;
  matchReason: string;
  similarityBand: 'high' | 'medium' | 'low';
}

export interface StyleProfile {
  deviceId: string;
  summary: string;
  tone: string[];
  structureHabits: Record<string, unknown>;
  ctaHabits: Record<string, unknown>;
  formatHabits: Record<string, unknown>;
  commonThemes: string[];
  confidence: number;
}

export interface UserPreferences {
  deviceId: string;
  preferredTone?: string | null;
  targetAudience?: string | null;
  preferredFormats: string[];
  ctaPreference?: string | null;
  emojiPreference?: string | null;
  forbiddenPhrases: string[];
  hardConstraints: string[];
}

export interface GenerationContext {
  memories: RetrievedMemory[];
  styleProfile: StyleProfile | null;
  preferences: UserPreferences | null;
  styleApplied: boolean;
  preferenceApplied: boolean;
}

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface WebSearchContext {
  query: string;
  summary: string;
  results: WebSearchResult[];
  images: string[];
}

