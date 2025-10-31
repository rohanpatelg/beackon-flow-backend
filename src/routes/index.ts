import express, { Router } from 'express';
import authRoutes from './authRoutes';
import linkedinRoutes from './linkedinRoutes';

const router: Router = express.Router();

// Auth routes (public)
router.use('/auth', authRoutes);

// LinkedIn routes
router.use('/linkedin', linkedinRoutes);

export default router; 