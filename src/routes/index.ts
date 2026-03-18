import express, { Router } from 'express';
import linkedinRoutes from './linkedinRoutes';
import postsRoutes from './postsRoutes';
import onboardingRoutes from './onboardingRoutes';
import cognitionRoutes from './cognitionRoutes';
import preferencesRoutes from './preferencesRoutes';

const router: Router = express.Router();

// LinkedIn routes (AI features: hooks, posts, intentions)
router.use('/linkedin', linkedinRoutes);

// Posts routes
router.use('/posts', postsRoutes);

// Onboarding routes
router.use('/onboarding', onboardingRoutes);

// Cognition routes
router.use('/cognition', cognitionRoutes);

// Preferences routes
router.use('/preferences', preferencesRoutes);

export default router;
