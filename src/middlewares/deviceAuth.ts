import { Request, Response, NextFunction, RequestHandler } from 'express';
import { pool } from '../config/database';

declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
    }
  }
}

export const validateDeviceId: RequestHandler = async (req, res, next) => {
  try {
    const deviceId = req.headers['x-device-id'] as string;

    if (!deviceId || typeof deviceId !== 'string') {
      res.status(401).json({
        success: false,
        message: 'X-Device-ID header required'
      });
      return;
    }

    // Upsert device record
    await pool.query(`
      INSERT INTO public.m_devices (device_id)
      VALUES ($1)
      ON CONFLICT (device_id) DO UPDATE SET updated_at = NOW()
    `, [deviceId]);

    req.deviceId = deviceId;
    next();
  } catch (error) {
    console.error('Device auth error:', error);
    res.status(500).json({ success: false, message: 'Device verification failed' });
  }
};
