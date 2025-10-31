import { Request, Response, NextFunction, RequestHandler } from 'express';
import { supabaseAdmin } from '@/config/supabase';

// Extend Express Request to include Supabase user
declare global {
  namespace Express {
    interface Request {
      supabaseUser?: {
        id: string;
        email?: string;
        user_metadata?: any;
        app_metadata?: any;
      };
    }
  }
}

/**
 * Middleware to validate Supabase JWT token
 * Extracts user from Authorization header and attaches to req.supabaseUser
 */
export const validateSupabaseToken: RequestHandler = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.'
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('Supabase auth error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please sign in again.'
      });
      return;
    }

    // Attach user to request
    req.supabaseUser = {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    };

    // Also set to req.user for compatibility with existing code
    req.user = {
      id: parseInt(user.id.split('-')[0], 16) || 1, // Convert UUID to number for legacy code
      email: user.email || '',
      username: user.user_metadata?.name || user.email?.split('@')[0] || 'user',
      is_active: true,
      is_email_verified: user.email_confirmed_at ? true : false,
      roles: ['user'],
      linkedin_id: user.user_metadata?.provider_id || user.user_metadata?.sub,
    };

    next();
  } catch (error) {
    console.error('Supabase authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication verification failed'
    });
  }
};

/**
 * Optional: Middleware to require specific OAuth provider
 */
export const requireLinkedInProvider: RequestHandler = (req, res, next) => {
  const user = req.supabaseUser;

  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  // Check if user authenticated with LinkedIn
  const hasLinkedIn = user.app_metadata?.providers?.includes('linkedin') ||
    user.user_metadata?.provider === 'linkedin';

  if (!hasLinkedIn) {
    res.status(403).json({
      success: false,
      message: 'LinkedIn authentication required for this action'
    });
    return;
  }

  next();
};
