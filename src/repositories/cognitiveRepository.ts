import { pool } from '@/config/database';
import { EmbeddingState, MemoryDocument, MemorySourceStatus, RetrievedMemory, StyleProfile } from '@/types';

export interface PostMemoryRow {
  id: number;
  device_id: string;
  post_id: number | null;
  source_type: string;
  source_status: string;
  source_text: string;
  summary: string;
  inferred_intent: string;
  themes: string[] | null;
  style_signals: Record<string, unknown> | null;
  topic: string | null;
  vector_document_id: string;
  embedding_state: EmbeddingState;
  sync_status: string;
  sync_version: number;
  embedding_json: number[] | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface StyleProfileRow {
  device_id: string;
  summary: string;
  tone: string[] | null;
  structure_habits: Record<string, unknown> | null;
  cta_habits: Record<string, unknown> | null;
  format_habits: Record<string, unknown> | null;
  common_themes: string[] | null;
  confidence_score: number;
}

const mapStyleProfileRow = (row: StyleProfileRow): StyleProfile => ({
  deviceId: row.device_id,
  summary: row.summary,
  tone: row.tone || [],
  structureHabits: row.structure_habits || {},
  ctaHabits: row.cta_habits || {},
  formatHabits: row.format_habits || {},
  commonThemes: row.common_themes || [],
  confidence: Number(row.confidence_score || 0),
});

const vectorLiteral = (embedding: number[]): string => `[${embedding.join(',')}]`;

export const getPgvectorExtensionStatus = async (): Promise<boolean> => {
  const query = `
    SELECT EXISTS(
      SELECT 1
      FROM pg_extension
      WHERE extname = 'vector'
    ) AS enabled
  `;

  const result = await pool.query(query);
  return result.rows[0]?.enabled === true;
};

export const upsertPostMemoryInDb = async (
  memory: MemoryDocument & {
    topic?: string | null;
    vectorDocumentId: string;
    syncStatus: string;
    syncVersion: number;
    embedding?: number[] | null;
    lastError?: string | null;
  }
): Promise<PostMemoryRow> => {
  const baseValues = [
    memory.deviceId,
    memory.postId || null,
    memory.sourceType,
    memory.sourceStatus,
    memory.text,
    memory.summary,
    memory.intent,
    JSON.stringify(memory.themes),
    JSON.stringify(memory.styleSignals),
    memory.topic || null,
    memory.vectorDocumentId,
    memory.embeddingState,
    memory.syncStatus,
    memory.syncVersion,
    memory.embedding ? JSON.stringify(memory.embedding) : null,
    memory.lastError || null,
  ];

  const fallbackQuery = `
    INSERT INTO public.m_post_memories (
      device_id,
      post_id,
      source_type,
      source_status,
      source_text,
      summary,
      inferred_intent,
      themes,
      style_signals,
      topic,
      vector_document_id,
      embedding_state,
      sync_status,
      sync_version,
      embedding_json,
      last_error,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
    ON CONFLICT (device_id, post_id)
    DO UPDATE SET
      source_type = EXCLUDED.source_type,
      source_status = EXCLUDED.source_status,
      source_text = EXCLUDED.source_text,
      summary = EXCLUDED.summary,
      inferred_intent = EXCLUDED.inferred_intent,
      themes = EXCLUDED.themes,
      style_signals = EXCLUDED.style_signals,
      topic = EXCLUDED.topic,
      vector_document_id = EXCLUDED.vector_document_id,
      embedding_state = EXCLUDED.embedding_state,
      sync_status = EXCLUDED.sync_status,
      sync_version = EXCLUDED.sync_version,
      embedding_json = EXCLUDED.embedding_json,
      last_error = EXCLUDED.last_error,
      updated_at = NOW()
    RETURNING *
  `;

  if (!memory.embedding || memory.embedding.length === 0) {
    const result = await pool.query(fallbackQuery, baseValues);
    return result.rows[0] as PostMemoryRow;
  }

  const vectorQuery = `
    INSERT INTO public.m_post_memories (
      device_id,
      post_id,
      source_type,
      source_status,
      source_text,
      summary,
      inferred_intent,
      themes,
      style_signals,
      topic,
      vector_document_id,
      embedding_state,
      sync_status,
      sync_version,
      embedding_json,
      embedding,
      last_error,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::vector, $17, NOW(), NOW())
    ON CONFLICT (device_id, post_id)
    DO UPDATE SET
      source_type = EXCLUDED.source_type,
      source_status = EXCLUDED.source_status,
      source_text = EXCLUDED.source_text,
      summary = EXCLUDED.summary,
      inferred_intent = EXCLUDED.inferred_intent,
      themes = EXCLUDED.themes,
      style_signals = EXCLUDED.style_signals,
      topic = EXCLUDED.topic,
      vector_document_id = EXCLUDED.vector_document_id,
      embedding_state = EXCLUDED.embedding_state,
      sync_status = EXCLUDED.sync_status,
      sync_version = EXCLUDED.sync_version,
      embedding_json = EXCLUDED.embedding_json,
      embedding = EXCLUDED.embedding,
      last_error = EXCLUDED.last_error,
      updated_at = NOW()
    RETURNING *
  `;

  try {
    const result = await pool.query(vectorQuery, [...baseValues, vectorLiteral(memory.embedding), memory.lastError || null]);
    return result.rows[0] as PostMemoryRow;
  } catch (error: any) {
    const result = await pool.query(fallbackQuery, [
      ...baseValues.slice(0, 12),
      'embedding_json_only',
      memory.syncVersion,
      JSON.stringify(memory.embedding),
      error.message || memory.lastError || null,
    ]);
    return result.rows[0] as PostMemoryRow;
  }
};

export const getPostMemoriesByDeviceFromDb = async (deviceId: string): Promise<PostMemoryRow[]> => {
  const query = `
    SELECT *
    FROM public.m_post_memories
    WHERE device_id = $1
    ORDER BY updated_at DESC
  `;

  const result = await pool.query(query, [deviceId]);
  return result.rows as PostMemoryRow[];
};

export const getPostMemoryCountsFromDb = async (deviceId: string): Promise<{ total: number; ready: number; failed: number }> => {
  const query = `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE embedding_state = 'ready')::int AS ready,
      COUNT(*) FILTER (WHERE embedding_state = 'failed')::int AS failed
    FROM public.m_post_memories
    WHERE device_id = $1
  `;

  const result = await pool.query(query, [deviceId]);
  return result.rows[0] || { total: 0, ready: 0, failed: 0 };
};

export const upsertStyleProfileInDb = async (
  profile: StyleProfile & { sampleCounts: Record<string, unknown> }
): Promise<StyleProfile> => {
  const query = `
    INSERT INTO public.m_style_profiles (
      device_id,
      summary,
      tone,
      structure_habits,
      cta_habits,
      format_habits,
      common_themes,
      confidence_score,
      sample_counts,
      last_recomputed_at,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())
    ON CONFLICT (device_id)
    DO UPDATE SET
      summary = EXCLUDED.summary,
      tone = EXCLUDED.tone,
      structure_habits = EXCLUDED.structure_habits,
      cta_habits = EXCLUDED.cta_habits,
      format_habits = EXCLUDED.format_habits,
      common_themes = EXCLUDED.common_themes,
      confidence_score = EXCLUDED.confidence_score,
      sample_counts = EXCLUDED.sample_counts,
      last_recomputed_at = NOW(),
      updated_at = NOW()
    RETURNING *
  `;

  const result = await pool.query(query, [
    profile.deviceId,
    profile.summary,
    JSON.stringify(profile.tone),
    JSON.stringify(profile.structureHabits),
    JSON.stringify(profile.ctaHabits),
    JSON.stringify(profile.formatHabits),
    JSON.stringify(profile.commonThemes),
    profile.confidence,
    JSON.stringify(profile.sampleCounts),
  ]);

  return mapStyleProfileRow(result.rows[0] as StyleProfileRow);
};

export const getStyleProfileByDeviceFromDb = async (deviceId: string): Promise<StyleProfile | null> => {
  const query = `
    SELECT *
    FROM public.m_style_profiles
    WHERE device_id = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [deviceId]);
  if (result.rows.length === 0) {
    return null;
  }

  return mapStyleProfileRow(result.rows[0] as StyleProfileRow);
};

export const querySimilarMemoriesWithVectorFromDb = async (
  deviceId: string,
  queryEmbedding: number[],
  limit: number,
  excludePostId?: number
): Promise<RetrievedMemory[]> => {
  const vectorQuery = `
    SELECT
      post_id,
      topic,
      summary,
      (1 - (embedding <=> $2::vector)) AS similarity,
      inferred_intent,
      source_status
    FROM public.m_post_memories
    WHERE device_id = $1
      AND embedding IS NOT NULL
      ${excludePostId ? 'AND (post_id IS NULL OR post_id != $4)' : ''}
    ORDER BY embedding <=> $2::vector
    LIMIT $3
  `;

  const params = excludePostId
    ? [deviceId, vectorLiteral(queryEmbedding), limit, excludePostId]
    : [deviceId, vectorLiteral(queryEmbedding), limit];

  const result = await pool.query(vectorQuery, params);
  return (result.rows || []).map((row: any) => ({
    postId: row.post_id || undefined,
    topic: row.topic,
    summary: row.summary,
    similarity: Number(row.similarity || 0),
    whyRelevant: `Similar ${row.source_status || 'founder'} post intent: ${row.inferred_intent || 'general'}`,
    matchReason: row.inferred_intent || 'semantic similarity',
    similarityBand: Number(row.similarity || 0) >= 0.88 ? 'high' : Number(row.similarity || 0) >= 0.76 ? 'medium' : 'low',
  }));
};
