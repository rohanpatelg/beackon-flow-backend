/**
 * Inject avatar context into existing LinkedIn generation prompts.
 * Returns null when the device has no avatar yet, so callers can no-op cleanly.
 */

import { getAvatarForDevice, UserAvatar } from '@/repositories/avatarRepository';

const truncate = (s: string, n: number) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

const formatList = (items: any[], max: number) =>
  (items || [])
    .filter((x) => typeof x === 'string' && x.trim())
    .slice(0, max)
    .map((x) => `- ${truncate(x.trim(), 200)}`)
    .join('\n');

/**
 * Build a compact prompt block summarizing the avatar's load-bearing fields.
 * Designed to slot into a system prompt without ballooning token cost.
 */
export const buildAvatarContextBlockForAvatar = (avatar: UserAvatar): string => {
  const lines: string[] = ['AVATAR CONTEXT (calibrate all output to this viewer):'];

  if (avatar.wake_up_thought) {
    lines.push(`Wake-Up Thought: "${truncate(avatar.wake_up_thought, 400)}"`);
  }

  const antiId =
    typeof avatar.anti_identity === 'object' && avatar.anti_identity && (avatar.anti_identity as any).raw
      ? (avatar.anti_identity as any).raw
      : '';
  if (antiId) {
    lines.push(`Anti-identity (NEVER sound like): ${truncate(antiId, 300)}`);
  }

  if (Array.isArray(avatar.voc_phrases) && avatar.voc_phrases.length) {
    lines.push('Voice of Customer (prefer these phrasings verbatim):');
    lines.push(formatList(avatar.voc_phrases, 8));
  }

  const tone =
    typeof avatar.brain_wiring === 'object' && avatar.brain_wiring
      ? (avatar.brain_wiring as any).messaging_tone
      : '';
  if (tone) {
    lines.push(`Messaging tone: ${truncate(tone, 200)}`);
  }

  const primaryEmotion =
    typeof avatar.brain_wiring === 'object' && avatar.brain_wiring
      ? (avatar.brain_wiring as any).primary_emotion
      : '';
  if (primaryEmotion) {
    lines.push(`Primary emotion they carry: ${truncate(primaryEmotion, 200)}`);
  }

  const proof =
    typeof avatar.brain_wiring === 'object' && avatar.brain_wiring
      ? (avatar.brain_wiring as any).proof_format
      : '';
  if (proof) {
    lines.push(`Proof format that resonates: ${truncate(proof, 200)}`);
  }

  const journey =
    typeof avatar.viewer === 'object' && avatar.viewer ? (avatar.viewer as any).journey_stage_label : '';
  if (journey) {
    lines.push(`Journey stage: ${journey}`);
  }

  return lines.join('\n');
};

export const buildAvatarContextBlock = async (
  deviceId: string | undefined
): Promise<string | null> => {
  if (!deviceId) return null;
  try {
    const avatar = await getAvatarForDevice(deviceId);
    if (!avatar) return null;
    return buildAvatarContextBlockForAvatar(avatar);
  } catch (err: any) {
    console.warn('buildAvatarContextBlock failed (non-fatal):', err.message);
    return null;
  }
};
