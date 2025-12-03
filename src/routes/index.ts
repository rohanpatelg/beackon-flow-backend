import express, { Router } from 'express';
import linkedinRoutes from './linkedinRoutes';
import postsRoutes from './postsRoutes';
import onboardingRoutes from './onboardingRoutes';

const router: Router = express.Router();

// LinkedIn routes
router.use('/linkedin', linkedinRoutes);

// Posts routes
router.use('/posts', postsRoutes);

// Onboarding routes
router.use('/onboarding', onboardingRoutes);

export default router; 