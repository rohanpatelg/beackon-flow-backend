import { pool } from '@/config/database';

export interface Questions {
  id: number;
  question_1: string | null;
  question_2: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface UserAnswers {
  id: number;
  device_id: string;
  questionaire_id: number | null;
  answer_1: string;
  answer_2: string;
  created_at: string;
  updated_at: string | null;
}

/**
 * Fetch questions from m_questions table
 * Returns the first (active) questionnaire
 */
export const fetchQuestionsFromDb = async (): Promise<Questions | null> => {
  const query = `
    SELECT * FROM public.m_questions
    ORDER BY id ASC
    LIMIT 1
  `;

  try {
    const result = await pool.query(query);
    return result.rows[0] || null;
  } catch (error: any) {
    console.error('Error fetching questions:', error);
    throw new Error(`Failed to fetch questions: ${error.message}`);
  }
};

/**
 * Check if user has completed onboarding (has answers)
 */
export const checkUserHasAnswers = async (deviceId: string): Promise<boolean> => {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM public.m_user_answers
      WHERE device_id = $1
    ) as has_answers
  `;

  try {
    const result = await pool.query(query, [deviceId]);
    return result.rows[0]?.has_answers || false;
  } catch (error: any) {
    console.error('Error checking user answers:', error);
    throw new Error(`Failed to check onboarding status: ${error.message}`);
  }
};

/**
 * Fetch user's answers from m_user_answers table
 */
export const fetchUserAnswersFromDb = async (deviceId: string): Promise<UserAnswers | null> => {
  const query = `
    SELECT * FROM public.m_user_answers
    WHERE device_id = $1
    LIMIT 1
  `;

  try {
    const result = await pool.query(query, [deviceId]);
    return result.rows[0] || null;
  } catch (error: any) {
    console.error('Error fetching user answers:', error);
    throw new Error(`Failed to fetch user answers: ${error.message}`);
  }
};

/**
 * Save new user answers to m_user_answers table
 */
export const saveUserAnswersToDb = async (
  deviceId: string,
  answers: {
    answer_1: string;
    answer_2: string;
  },
  questionaireId?: number
): Promise<UserAnswers> => {
  const query = `
    INSERT INTO public.m_user_answers (
      device_id,
      questionaire_id,
      answer_1,
      answer_2,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING *
  `;

  try {
    const result = await pool.query(query, [
      deviceId,
      questionaireId || null,
      answers.answer_1,
      answers.answer_2,
    ]);
    return result.rows[0];
  } catch (error: any) {
    console.error('Error saving user answers:', error);
    throw new Error(`Failed to save user answers: ${error.message}`);
  }
};

/**
 * Upsert user answers — update if exists, insert if not
 */
export const updateUserAnswersInDb = async (
  deviceId: string,
  answers: {
    answer_1: string;
    answer_2: string;
  },
  questionaireId?: number
): Promise<UserAnswers> => {
  const updateQuery = `
    UPDATE public.m_user_answers
    SET
      answer_1 = $2,
      answer_2 = $3,
      updated_at = NOW()
    WHERE device_id = $1
    RETURNING *
  `;

  const insertQuery = `
    INSERT INTO public.m_user_answers (
      device_id,
      questionaire_id,
      answer_1,
      answer_2,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING *
  `;

  try {
    // Try update first
    const updateResult = await pool.query(updateQuery, [
      deviceId,
      answers.answer_1,
      answers.answer_2,
    ]);

    if (updateResult.rows.length > 0) {
      return updateResult.rows[0];
    }

    // No existing row — insert instead
    const insertResult = await pool.query(insertQuery, [
      deviceId,
      questionaireId || null,
      answers.answer_1,
      answers.answer_2,
    ]);
    return insertResult.rows[0];
  } catch (error: any) {
    console.error('Error upserting user answers:', error);
    throw new Error(`Failed to save user answers: ${error.message}`);
  }
};
