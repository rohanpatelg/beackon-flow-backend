import { UserPreferences } from '@/types';
import { getUserPreferencesFromDb, upsertUserPreferencesInDb } from '@/repositories/preferencesRepository';

const normalizeArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const getUserPreferences = async (deviceId: string): Promise<UserPreferences | null> => {
  return getUserPreferencesFromDb(deviceId);
};

export const upsertUserPreferences = async (
  deviceId: string,
  input: Partial<UserPreferences>
): Promise<UserPreferences> => {
  const normalized: UserPreferences = {
    deviceId,
    preferredTone: typeof input.preferredTone === 'string' ? input.preferredTone.trim() : null,
    targetAudience: typeof input.targetAudience === 'string' ? input.targetAudience.trim() : null,
    preferredFormats: normalizeArray(input.preferredFormats),
    ctaPreference: typeof input.ctaPreference === 'string' ? input.ctaPreference.trim() : null,
    emojiPreference: typeof input.emojiPreference === 'string' ? input.emojiPreference.trim() : null,
    forbiddenPhrases: normalizeArray(input.forbiddenPhrases),
    hardConstraints: normalizeArray(input.hardConstraints),
  };

  return upsertUserPreferencesInDb(normalized);
};

export const hasExplicitPreferences = (preferences: UserPreferences | null): boolean => {
  if (!preferences) {
    return false;
  }

  return Boolean(
    preferences.preferredTone ||
      preferences.targetAudience ||
      preferences.ctaPreference ||
      preferences.emojiPreference ||
      preferences.preferredFormats.length > 0 ||
      preferences.forbiddenPhrases.length > 0 ||
      preferences.hardConstraints.length > 0
  );
};
