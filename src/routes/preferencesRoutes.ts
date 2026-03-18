import express, { Router } from 'express';
import { validateDeviceId } from '@/middlewares/deviceAuth';
import { getPreferences, updatePreferences } from '@/controllers/preferencesController';

const router: Router = express.Router();

router.get('/', validateDeviceId, getPreferences);
router.put('/', validateDeviceId, updatePreferences);

export default router;
