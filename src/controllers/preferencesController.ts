import { Request, Response } from 'express';
import { getUserPreferences, upsertUserPreferences } from '@/services/preferenceService';

export const getPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId;

    if (!deviceId) {
      res.status(401).json({ success: false, message: 'Device not identified' });
      return;
    }

    const preferences = await getUserPreferences(deviceId);
    res.status(200).json({ success: true, data: preferences });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch preferences' });
  }
};

export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId;

    if (!deviceId) {
      res.status(401).json({ success: false, message: 'Device not identified' });
      return;
    }

    const preferences = await upsertUserPreferences(deviceId, req.body || {});
    res.status(200).json({ success: true, data: preferences });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update preferences' });
  }
};
