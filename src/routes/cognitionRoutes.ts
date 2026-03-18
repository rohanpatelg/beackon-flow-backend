import express, { Router } from 'express';
import { validateDeviceId } from '@/middlewares/deviceAuth';
import { getCognitionProfile, getCognitionStatus, rebuildCognition } from '@/controllers/cognitionController';

const router: Router = express.Router();

router.post('/rebuild', validateDeviceId, rebuildCognition);
router.get('/profile', validateDeviceId, getCognitionProfile);
router.get('/status', validateDeviceId, getCognitionStatus);

export default router;
