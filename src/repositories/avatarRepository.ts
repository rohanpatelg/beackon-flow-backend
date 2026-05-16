import { pool } from '@/config/database';

export type AvatarSessionStatus = 1 | 2 | 3; // 1=in_progress, 2=complete, 3=abandoned

export interface AvatarMessage {
  role: 'bot' | 'user';
  text: string;
  step_id?: string;
  ts: string;
}

export interface AvatarSession {
  id: string;
  device_id: string;
  current_step_id: string;
  status: AvatarSessionStatus;
  answers: Record<string, any>;
  message_log: AvatarMessage[];
  client_data: string[];
  patterns: any | null;
  created_at: string;
  updated_at: string;
}

export interface UserAvatar {
  id: string;
  device_id: string;
  session_id: string | null;
  wake_up_thought: string;
  backstory: string | null;
  viewer: Record<string, any>;
  generational: Record<string, any>;
  brain_wiring: Record<string, any>;
  drivers: Record<string, any>;
  anti_identity: Record<string, any>;
  heroes: any[];
  voc_phrases: string[];
  stop_scroll: string[];
  patterns: any | null;
  markdown: string;
  created_at: string;
  updated_at: string;
}

/**
 * Find the most recent in-progress session for a device, if any.
 */
export const getInProgressSessionForDevice = async (
  deviceId: string
): Promise<AvatarSession | null> => {
  const query = `
    SELECT * FROM public.m_avatar_sessions
    WHERE device_id = $1 AND status = 1
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [deviceId]);
  return rows[0] || null;
};

export const getSessionById = async (
  sessionId: string,
  deviceId: string
): Promise<AvatarSession | null> => {
  const query = `
    SELECT * FROM public.m_avatar_sessions
    WHERE id = $1 AND device_id = $2
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [sessionId, deviceId]);
  return rows[0] || null;
};

export const createSession = async (
  deviceId: string,
  startingStepId: string
): Promise<AvatarSession> => {
  const query = `
    INSERT INTO public.m_avatar_sessions (device_id, current_step_id, status, answers, message_log, client_data)
    VALUES ($1, $2, 1, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [deviceId, startingStepId]);
  return rows[0];
};

export const updateSession = async (
  sessionId: string,
  patch: Partial<Pick<AvatarSession, 'current_step_id' | 'status' | 'answers' | 'message_log' | 'client_data' | 'patterns'>>
): Promise<AvatarSession> => {
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (patch.current_step_id !== undefined) {
    sets.push(`current_step_id = $${i++}`);
    params.push(patch.current_step_id);
  }
  if (patch.status !== undefined) {
    sets.push(`status = $${i++}::smallint`);
    params.push(patch.status);
  }
  if (patch.answers !== undefined) {
    sets.push(`answers = $${i++}::jsonb`);
    params.push(JSON.stringify(patch.answers));
  }
  if (patch.message_log !== undefined) {
    sets.push(`message_log = $${i++}::jsonb`);
    params.push(JSON.stringify(patch.message_log));
  }
  if (patch.client_data !== undefined) {
    sets.push(`client_data = $${i++}::jsonb`);
    params.push(JSON.stringify(patch.client_data));
  }
  if (patch.patterns !== undefined) {
    sets.push(`patterns = $${i++}::jsonb`);
    params.push(patch.patterns === null ? null : JSON.stringify(patch.patterns));
  }

  sets.push(`updated_at = NOW()`);
  params.push(sessionId);

  const query = `
    UPDATE public.m_avatar_sessions
    SET ${sets.join(', ')}
    WHERE id = $${i}
    RETURNING *
  `;
  const { rows } = await pool.query(query, params);
  if (rows.length === 0) throw new Error('Avatar session not found');
  return rows[0];
};

export const getAvatarForDevice = async (deviceId: string): Promise<UserAvatar | null> => {
  const query = `
    SELECT * FROM public.m_user_avatars
    WHERE device_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(query, [deviceId]);
  return rows[0] || null;
};

export interface UpsertAvatarInput {
  device_id: string;
  session_id: string | null;
  wake_up_thought: string;
  backstory: string | null;
  viewer: Record<string, any>;
  generational: Record<string, any>;
  brain_wiring: Record<string, any>;
  drivers: Record<string, any>;
  anti_identity: Record<string, any>;
  heroes: any[];
  voc_phrases: string[];
  stop_scroll: string[];
  patterns: any | null;
  markdown: string;
}

export const upsertAvatar = async (input: UpsertAvatarInput): Promise<UserAvatar> => {
  const query = `
    INSERT INTO public.m_user_avatars (
      device_id, session_id, wake_up_thought, backstory,
      viewer, generational, brain_wiring, drivers,
      anti_identity, heroes, voc_phrases, stop_scroll,
      patterns, markdown
    )
    VALUES (
      $1, $2, $3, $4,
      $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
      $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb,
      $13::jsonb, $14
    )
    ON CONFLICT (device_id) DO UPDATE SET
      session_id      = EXCLUDED.session_id,
      wake_up_thought = EXCLUDED.wake_up_thought,
      backstory       = EXCLUDED.backstory,
      viewer          = EXCLUDED.viewer,
      generational    = EXCLUDED.generational,
      brain_wiring    = EXCLUDED.brain_wiring,
      drivers         = EXCLUDED.drivers,
      anti_identity   = EXCLUDED.anti_identity,
      heroes          = EXCLUDED.heroes,
      voc_phrases     = EXCLUDED.voc_phrases,
      stop_scroll     = EXCLUDED.stop_scroll,
      patterns        = EXCLUDED.patterns,
      markdown        = EXCLUDED.markdown,
      updated_at      = NOW()
    RETURNING *
  `;
  const params = [
    input.device_id,
    input.session_id,
    input.wake_up_thought,
    input.backstory,
    JSON.stringify(input.viewer),
    JSON.stringify(input.generational),
    JSON.stringify(input.brain_wiring),
    JSON.stringify(input.drivers),
    JSON.stringify(input.anti_identity),
    JSON.stringify(input.heroes),
    JSON.stringify(input.voc_phrases),
    JSON.stringify(input.stop_scroll),
    input.patterns === null ? null : JSON.stringify(input.patterns),
    input.markdown,
  ];
  const { rows } = await pool.query(query, params);
  return rows[0];
};

export const abandonSession = async (sessionId: string, deviceId: string): Promise<void> => {
  await pool.query(
    `UPDATE public.m_avatar_sessions SET status = 3, updated_at = NOW() WHERE id = $1 AND device_id = $2`,
    [sessionId, deviceId]
  );
};
