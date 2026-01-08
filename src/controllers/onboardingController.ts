import { Request, Response } from 'express';
import {
  fetchQuestionsFromDb,
  checkUserHasAnswers,
  fetchUserAnswersFromDb,
  saveUserAnswersToDb,
  updateUserAnswersInDb,
} from '@/repositories/onboardingRepository';

/**
 * Get onboarding questions
 * @route GET /api/onboarding/questions
 */
export const getQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const questions = await fetchQuestionsFromDb();

    if (!questions) {
      res.status(404).json({
        success: false,
        message: 'No questions found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: questions,
    });
  } catch (error: any) {
    console.error('Error in getQuestions controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch questions',
    });
  }
};

/**
 * Check if user has completed onboarding
 * @route GET /api/onboarding/status
 */
export const getOnboardingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId;

    if (!deviceId) {
      res.status(401).json({
        success: false,
        message: 'Device not identified',
      });
      return;
    }

    const hasCompleted = await checkUserHasAnswers(deviceId);

    res.status(200).json({
      success: true,
      data: {
        completed: hasCompleted,
      },
    });
  } catch (error: any) {
    console.error('Error in getOnboardingStatus controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check onboarding status',
    });
  }
};

/**
 * Get user's onboarding answers
 * @route GET /api/onboarding/answers
 */
export const getUserAnswers = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId;

    if (!deviceId) {
      res.status(401).json({
        success: false,
        message: 'Device not identified',
      });
      return;
    }

    const answers = await fetchUserAnswersFromDb(deviceId);

    res.status(200).json({
      success: true,
      data: answers, // Can be null if user hasn't completed onboarding
    });
  } catch (error: any) {
    console.error('Error in getUserAnswers controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user answers',
    });
  }
};

/**
 * Save new user onboarding answers
 * @route POST /api/onboarding/answers
 * @body { answer_1: string, answer_2: string, answer_3: string, answer_4?: string, questionaire_id?: number }
 */
export const saveUserAnswers = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId;

    if (!deviceId) {
      res.status(401).json({
        success: false,
        message: 'Device not identified',
      });
      return;
    }

    const { answer_1, answer_2, answer_3, answer_4, questionaire_id } = req.body;

    // Validate required fields
    if (!answer_1 || typeof answer_1 !== 'string' || answer_1.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Answer 1 is required',
      });
      return;
    }

    if (!answer_2 || typeof answer_2 !== 'string' || answer_2.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Answer 2 is required',
      });
      return;
    }

    if (!answer_3 || typeof answer_3 !== 'string' || answer_3.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Answer 3 is required',
      });
      return;
    }

    // Check if user already has answers
    const existingAnswers = await fetchUserAnswersFromDb(deviceId);
    if (existingAnswers) {
      res.status(409).json({
        success: false,
        message: 'User has already completed onboarding. Use PUT to update answers.',
      });
      return;
    }

    const savedAnswers = await saveUserAnswersToDb(
      deviceId,
      {
        answer_1: answer_1.trim(),
        answer_2: answer_2.trim(),
        answer_3: answer_3.trim(),
        answer_4: answer_4?.trim() || undefined,
      },
      questionaire_id
    );

    res.status(201).json({
      success: true,
      data: savedAnswers,
    });
  } catch (error: any) {
    console.error('Error in saveUserAnswers controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save user answers',
    });
  }
};

/**
 * Update existing user onboarding answers
 * @route PUT /api/onboarding/answers
 * @body { answer_1: string, answer_2: string, answer_3: string, answer_4?: string }
 */
export const updateUserAnswers = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId;

    if (!deviceId) {
      res.status(401).json({
        success: false,
        message: 'Device not identified',
      });
      return;
    }

    const { answer_1, answer_2, answer_3, answer_4 } = req.body;

    // Validate required fields
    if (!answer_1 || typeof answer_1 !== 'string' || answer_1.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Answer 1 is required',
      });
      return;
    }

    if (!answer_2 || typeof answer_2 !== 'string' || answer_2.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Answer 2 is required',
      });
      return;
    }

    if (!answer_3 || typeof answer_3 !== 'string' || answer_3.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Answer 3 is required',
      });
      return;
    }

    const updatedAnswers = await updateUserAnswersInDb(deviceId, {
      answer_1: answer_1.trim(),
      answer_2: answer_2.trim(),
      answer_3: answer_3.trim(),
      answer_4: answer_4?.trim() || undefined,
    });

    res.status(200).json({
      success: true,
      data: updatedAnswers,
    });
  } catch (error: any) {
    console.error('Error in updateUserAnswers controller:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update user answers',
    });
  }
};
