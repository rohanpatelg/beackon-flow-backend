import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserWithRoles, UserData } from '@/types/auth';
import { pool } from '@/config/database';

// Custom interface for Request with user property
interface RequestWithUser extends Request {
   user?: UserData;
}

/**
 * Middleware to verify if user is authenticated
 */
export const isAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
         res.status(401).json({
            success: false,
            message: 'Authentication required'
         });
         return;
      }

      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET;

      if (!secret) {
         throw new Error('JWT_SECRET not configured');
      }

      // Verify token
      const decoded = jwt.verify(token, secret) as JwtPayload;

      // Get user from database with their roles
      const query = `
         SELECT 
            u.id, 
            u.email, 
            u.username, 
            u.is_active, 
            u.is_email_verified,
            COALESCE(json_agg(
               json_build_object(
                  'role', json_build_object('role_name', r.role_name)
               )
            ) FILTER (WHERE r.role_name IS NOT NULL), '[]') as roles
         FROM bestinciti_prod.m_users u
         LEFT JOIN bestinciti_prod.m_user_roles ur ON u.id = ur.user_id
         LEFT JOIN bestinciti_prod.m_roles r ON ur.role_id = r.id
         WHERE u.id = $1
         GROUP BY u.id, u.email, u.username, u.is_active, u.is_email_verified
      `;

      const result = await pool.query(query, [decoded.id]);
      const user = result.rows[0] as UserWithRoles | null;

      if (!user) {
         res.status(401).json({
            success: false,
            message: 'User not found'
         });
         return;
      }

      if (!user.is_active) {
         res.status(401).json({
            success: false,
            message: 'Account is inactive'
         });
         return;
      }

      // Transform roles array for easier access
      const roles = user.roles.map(ur => ur.role.role_name);

      // Attach user and roles to request
      const authReq = req as RequestWithUser;
      authReq.user = {
         id: user.id,
         email: user.email,
         username: user.username,
         is_active: user.is_active || false,
         is_email_verified: user.is_email_verified,
         roles
      };

      next();
   } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
         res.status(401).json({
            success: false,
            message: 'Token expired',
            expired: true
         });
         return;
      }
      res.status(401).json({
         success: false,
         message: 'Authentication failed'
      });
   }
};

/**
 * Middleware to verify if user is an admin
 */
export const isAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const authReq = req as RequestWithUser;
      if (!authReq.user) {
         res.status(401).json({
            success: false,
            message: 'Authentication required'
         });
         return;
      }

      if (!authReq.user.roles.includes('admin')) {
         res.status(403).json({
            success: false,
            message: 'Admin privileges required'
         });
         return;
      }

      next();
   } catch (error) {
      console.error('Authorization error:', error);
      res.status(403).json({
         success: false,
         message: 'Authorization failed'
      });
   }
};

/**
 * Middleware to verify if user has the 'business_owner' role
 * Having the 'business_owner' role means the user can:
 * - Create new businesses
 * - Access business owner features
 * - Be assigned as an owner of specific businesses
 */
export const hasBusinessOwnerRole: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const authReq = req as RequestWithUser;
      if (!authReq.user) {
         res.status(401).json({
            success: false,
            message: 'Authentication required'
         });
         return;
      }

      if (!authReq.user.roles.includes('business_owner') && !authReq.user.roles.includes('admin')) {
         res.status(403).json({
            success: false,
            message: 'Business owner privileges required'
         });
         return;
      }

      next();
   } catch (error) {
      console.error('Authorization error:', error);
      res.status(403).json({
         success: false,
         message: 'Authorization failed'
      });
   }
};

/**
 * Middleware to verify if user is an owner of a specific business
 * Multiple users can own/manage the same business (co-owners, partners)
 * A user with 'business_owner' role may not necessarily own this specific business
 */
export const isOwnerOfSpecificBusiness: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const authReq = req as RequestWithUser;
      if (!authReq.user) {
         res.status(401).json({
            success: false,
            message: 'Authentication required'
         });
         return;
      }

      // Admin can access any business
      if (authReq.user.roles.includes('admin')) {
         next();
         return;
      }

      const businessId = parseInt(req.params.id);

      if (isNaN(businessId)) {
         res.status(400).json({
            success: false,
            message: 'Invalid business ID'
         });
         return;
      }

      // Query to check if the user owns the business
      const query = `
         SELECT * FROM bestinciti_prod.m_business_owners
         WHERE business_id = $1 AND user_id = $2
         LIMIT 1
      `;

      const result = await pool.query(query, [businessId, authReq.user.id]);
      const businessOwnership = result.rows[0];

      if (!businessOwnership) {
         res.status(403).json({
            success: false,
            message: 'You do not have permission to access this business'
         });
         return;
      }

      next();
   } catch (error) {
      console.error('Business ownership verification error:', error);
      res.status(500).json({
         success: false,
         message: 'Authorization verification failed'
      });
   }
};

// Alias for isAuth for better naming
export const authenticateToken = isAuth; 