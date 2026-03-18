import { pool } from '@/config/database';
import { UserPreferences } from '@/types';

interface PreferenceRow {
  device_id: string;
  preferred_tone: string | null;
  target_audience: string | null;
  preferred_formats: string[] | null;
  cta_preference: string | null;
  emoji_preference: string | null;
  forbidden_phrases: string[] | null;
  hard_constraints: string[] | null;
}

const mapPreferenceRow = (row: PreferenceRow): UserPreferences => ({
  deviceId: row.device_id,
  preferredTone: row.preferred_tone,
  targetAudience: row.target_audience,
  preferredFormats: row.preferred_formats || [],
  ctaPreference: row.cta_preference,
  emojiPreference: row.emoji_preference,
  forbiddenPhrases: row.forbidden_phrases || [],
  hardConstraints: row.hard_constraints || [],
});

export const getUserPreferencesFromDb = async (deviceId: string): Promise<UserPreferences | null> => {
  const query = `
    SELECT *
    FROM public.m_user_preferences
    WHERE device_id = $1
    LIMIT 1
  `;

  const result = await pool.query(query, [deviceId]);
  if (result.rows.length === 0) {
    return null;
  }

  return mapPreferenceRow(result.rows[0] as PreferenceRow);
};

export const upsertUserPreferencesInDb = async (
  preferences: UserPreferences
): Promise<UserPreferences> => {
  const query = `
    INSERT INTO public.m_user_preferences (
      device_id,
      preferred_tone,
      target_audience,
      preferred_formats,
      cta_preference,
      emoji_preference,
      forbidden_phrases,
      hard_constraints,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    ON CONFLICT (device_id)
    DO UPDATE SET
      preferred_tone = EXCLUDED.preferred_tone,
      target_audience = EXCLUDED.target_audience,
      preferred_formats = EXCLUDED.preferred_formats,
      cta_preference = EXCLUDED.cta_preference,
      emoji_preference = EXCLUDED.emoji_preference,
      forbidden_phrases = EXCLUDED.forbidden_phrases,
      hard_constraints = EXCLUDED.hard_constraints,
      updated_at = NOW()
    RETURNING *
  `;

  const result = await pool.query(query, [
    preferences.deviceId,
    preferences.preferredTone || null,
    preferences.targetAudience || null,
    JSON.stringify(preferences.preferredFormats || []),
    preferences.ctaPreference || null,
    preferences.emojiPreference || null,
    JSON.stringify(preferences.forbiddenPhrases || []),
    JSON.stringify(preferences.hardConstraints || []),
  ]);

  return mapPreferenceRow(result.rows[0] as PreferenceRow);
};
