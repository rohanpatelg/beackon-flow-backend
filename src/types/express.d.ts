import { Express } from 'express-serve-static-core';

declare module 'express-serve-static-core' {
   interface Request {
      user?: {
         id: number;
         email: string;
         username: string;
         is_active: boolean;
         is_email_verified: boolean;
         roles: string[];
         linkedin_id?: string;
      };
   }
} 