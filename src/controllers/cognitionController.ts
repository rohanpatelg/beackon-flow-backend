import { Request, Response } from 'express';
import { getCognitionProfileForDevice, getCognitionStatusForDevice, rebuildCognitionForDevice } from '@/services/cognitiveMemoryService';

export const rebuildCognition = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId;
    if (!deviceId) {
      res.status(401).json({ success: false, message: 'Device not identified' });
      return;
    }

    const result = await rebuildCognitionForDevice(deviceId);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to rebuild cognition' });
  }
};

export const getCognitionProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId;
    if (!deviceId) {
      res.status(401).json({ success: false, message: 'Device not identified' });
      return;
    }

    const context = await getCognitionProfileForDevice(deviceId);
    res.status(200).json({
      success: true,
      data: {
        styleProfile: context.styleProfile,
        preferences: context.preferences,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch cognition profile' });
  }
};

export const getCognitionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.deviceId;
    if (!deviceId) {
      res.status(401).json({ success: false, message: 'Device not identified' });
      return;
    }

    const status = await getCognitionStatusForDevice(deviceId);
    res.status(200).json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch cognition status' });
  }
};
