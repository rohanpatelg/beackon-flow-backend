import { Request, Response } from 'express';
import {
  STEPS,
  STARTING_STEP_ID,
  getStep,
  buildAnswerContext,
  normalizeChoice,
  AvatarStep,
} from '@/services/avatarFlowService';
import {
  runVaguenessCheck,
  runCoachMode,
  synthesizeClientPatterns,
} from '@/services/avatarPromptsService';
import { buildAvatarFromSession } from '@/services/avatarSynthesisService';
import {
  AvatarMessage,
  AvatarSession,
  abandonSession,
  createSession,
  getAvatarForDevice,
  getInProgressSessionForDevice,
  getSessionById,
  updateSession,
  upsertAvatar,
} from '@/repositories/avatarRepository';

const TOTAL_QUESTIONS = 25;
const MAX_VAGUENESS_RETRIES = 2;

const nowISO = () => new Date().toISOString();

const appendMessage = (
  log: AvatarMessage[],
  msg: Omit<AvatarMessage, 'ts'>
): AvatarMessage[] => [...log, { ...msg, ts: nowISO() }];

const stepView = (step: AvatarStep, ctx: any) => ({
  step_id: step.id,
  question_number: step.questionNumber,
  total_questions: TOTAL_QUESTIONS,
  input_type: step.inputType,
  choices: step.choices ?? null,
  prompt: step.prompt(ctx),
});

const sessionView = (session: AvatarSession) => {
  const step = getStep(session.current_step_id);
  const ctx = buildAnswerContext(session);
  return {
    session_id: session.id,
    status: session.status,
    is_complete: session.status === 2,
    message_log: session.message_log,
    current_step: step ? stepView(step, ctx) : null,
  };
};

/**
 * POST /api/avatar/session/start
 * Resume the active in-progress session for the device, or start a fresh one.
 */
export const startSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId!;
    let session = await getInProgressSessionForDevice(deviceId);

    if (!session) {
      session = await createSession(deviceId, STARTING_STEP_ID);
      const firstStep = getStep(STARTING_STEP_ID)!;
      const ctx = buildAnswerContext(session);
      const log = appendMessage(session.message_log, {
        role: 'bot',
        text: firstStep.prompt(ctx),
        step_id: firstStep.id,
      });
      session = await updateSession(session.id, { message_log: log });
    }

    res.status(200).json({ success: true, data: sessionView(session) });
  } catch (err: any) {
    console.error('startSession error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to start avatar session' });
  }
};

/**
 * POST /api/avatar/session/:id/answer
 * Body: { answer: string }
 * Returns the next step (or completion signal) after applying the state machine.
 */
export const submitAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId!;
    const { id } = req.params;
    const { answer } = req.body;

    if (typeof answer !== 'string') {
      res.status(400).json({ success: false, message: 'answer (string) required' });
      return;
    }

    const session = await getSessionById(id, deviceId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }
    if (session.status !== 1) {
      res.status(400).json({ success: false, message: 'Session is not in progress' });
      return;
    }

    const currentStep = getStep(session.current_step_id);
    if (!currentStep) {
      res.status(500).json({ success: false, message: `Unknown step: ${session.current_step_id}` });
      return;
    }

    const trimmed = answer.trim();
    let log = appendMessage(session.message_log, {
      role: 'user',
      text: trimmed,
      step_id: currentStep.id,
    });

    // ── Cross-cutting: coach mode ────────────────────────────────────────────
    if (trimmed.toLowerCase() === 'help') {
      const ctx = buildAnswerContext(session);
      const coachReply = await runCoachMode(currentStep.id, currentStep.prompt(ctx), session.answers);
      log = appendMessage(log, { role: 'bot', text: coachReply, step_id: currentStep.id });
      // Re-emit the original question so the user has it in view.
      log = appendMessage(log, { role: 'bot', text: currentStep.prompt(ctx), step_id: currentStep.id });
      const updated = await updateSession(session.id, { message_log: log });
      res.status(200).json({ success: true, data: sessionView(updated) });
      return;
    }

    // ── Special: paste-loop (Step 2.0) ───────────────────────────────────────
    if (currentStep.inputType === 'paste-loop') {
      const lower = trimmed.toLowerCase();
      const isDone = lower === 'done';
      const isSkip = lower === 'skip';
      const hasPasted = (session.client_data || []).length > 0;

      if (isSkip || (isDone && !hasPasted)) {
        const advanced = await advanceTo(session, currentStep.next(trimmed, buildAnswerContext(session)), log, {
          recordAnswer: false,
        });
        res.status(200).json({ success: true, data: sessionView(advanced) });
        return;
      }

      if (isDone) {
        const { patterns, summaryMessage } = await synthesizeClientPatterns(session.client_data);
        log = appendMessage(log, { role: 'bot', text: summaryMessage, step_id: currentStep.id });
        const sessionWithPatterns = await updateSession(session.id, {
          patterns,
          message_log: log,
        });
        const advanced = await advanceTo(
          sessionWithPatterns,
          currentStep.next(trimmed, buildAnswerContext(sessionWithPatterns)),
          sessionWithPatterns.message_log,
          { recordAnswer: false }
        );
        res.status(200).json({ success: true, data: sessionView(advanced) });
        return;
      }

      // Otherwise: append submission, stay on 2.0.
      const newClientData = [...(session.client_data || []), trimmed];
      log = appendMessage(log, {
        role: 'bot',
        text: `Got it — submission #${newClientData.length} saved. Paste another, or type \`done\` when finished.`,
        step_id: currentStep.id,
      });
      const updated = await updateSession(session.id, {
        client_data: newClientData,
        message_log: log,
      });
      res.status(200).json({ success: true, data: sessionView(updated) });
      return;
    }

    // ── Choice validation ────────────────────────────────────────────────────
    let storedAnswer = trimmed;
    if (currentStep.inputType === 'choice') {
      const normalized = normalizeChoice(currentStep, trimmed);
      if (!normalized) {
        log = appendMessage(log, {
          role: 'bot',
          text: `Please pick one of: ${currentStep.choices!.map((c) => c.id).join(', ')}.`,
          step_id: currentStep.id,
        });
        const updated = await updateSession(session.id, { message_log: log });
        res.status(200).json({ success: true, data: sessionView(updated) });
        return;
      }
      storedAnswer = normalized;
    }

    // ── Vagueness check (text steps only) ────────────────────────────────────
    if (currentStep.vaguenessCheck && currentStep.inputType === 'text') {
      const attemptsKey = `__vagueness_attempts__${currentStep.id}`;
      const attempts = (session.answers[attemptsKey] as number) || 0;
      if (attempts < MAX_VAGUENESS_RETRIES) {
        const result = await runVaguenessCheck(currentStep.id, trimmed);
        if (!result.ok) {
          log = appendMessage(log, {
            role: 'bot',
            text: result.pushback || 'Give that another shot with a bit more detail.',
            step_id: currentStep.id,
          });
          const newAnswers = { ...session.answers, [attemptsKey]: attempts + 1 };
          const updated = await updateSession(session.id, {
            message_log: log,
            answers: newAnswers,
          });
          res.status(200).json({ success: true, data: sessionView(updated) });
          return;
        }
      }
    }

    // ── Record answer and advance ────────────────────────────────────────────
    const newAnswers = { ...session.answers, [currentStep.id]: storedAnswer };
    const ctxForNext = { ...newAnswers, hasClientData: (session.client_data || []).length > 0 };
    const nextId = currentStep.next(storedAnswer, ctxForNext);
    const interim = await updateSession(session.id, { answers: newAnswers, message_log: log });
    const advanced = await advanceTo(interim, nextId, interim.message_log, { recordAnswer: false });
    res.status(200).json({ success: true, data: sessionView(advanced) });
  } catch (err: any) {
    console.error('submitAnswer error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to submit answer' });
  }
};

/**
 * Internal: move the session to `nextId`, append the next step's bot prompt
 * to the message log, and persist. When nextId === 'complete', flips status
 * to 2 and stops; the client should then call /complete.
 */
const advanceTo = async (
  session: AvatarSession,
  nextId: string,
  log: AvatarMessage[],
  opts: { recordAnswer: boolean }
): Promise<AvatarSession> => {
  if (nextId === 'complete') {
    return updateSession(session.id, {
      current_step_id: 'complete',
      status: 2,
      message_log: appendMessage(log, {
        role: 'bot',
        text: `Great — we've got everything we need. I'm putting your Avatar Document together now…`,
        step_id: 'complete',
      }),
    });
  }

  const nextStep = getStep(nextId);
  if (!nextStep) throw new Error(`Unknown next step: ${nextId}`);
  const ctx = buildAnswerContext({ ...session, current_step_id: nextId });
  const newLog = appendMessage(log, {
    role: 'bot',
    text: nextStep.prompt(ctx),
    step_id: nextStep.id,
  });
  return updateSession(session.id, {
    current_step_id: nextId,
    message_log: newLog,
  });
};

/**
 * POST /api/avatar/session/:id/complete
 * Synthesize and persist the final avatar. Idempotent — returns the existing
 * avatar if synthesis already ran.
 */
export const completeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId!;
    const { id } = req.params;

    const session = await getSessionById(id, deviceId);
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }
    if (session.current_step_id !== 'complete' && session.status !== 2) {
      res.status(400).json({ success: false, message: 'Session is not finished yet' });
      return;
    }

    const input = await buildAvatarFromSession(session);
    const avatar = await upsertAvatar(input);
    res.status(200).json({ success: true, data: { avatar } });
  } catch (err: any) {
    console.error('completeSession error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to complete avatar' });
  }
};

/**
 * GET /api/avatar
 * Return the current avatar for the device, or null.
 */
export const getMyAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId!;
    const avatar = await getAvatarForDevice(deviceId);
    res.status(200).json({ success: true, data: { avatar } });
  } catch (err: any) {
    console.error('getMyAvatar error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch avatar' });
  }
};

/**
 * DELETE /api/avatar/session/:id
 * Abandon an in-progress session so the next /start creates a fresh one.
 */
export const abandonAvatarSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId!;
    const { id } = req.params;
    await abandonSession(id, deviceId);
    res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('abandonAvatarSession error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to abandon session' });
  }
};
