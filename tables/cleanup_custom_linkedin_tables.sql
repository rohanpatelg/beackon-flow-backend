-- ============================================================
-- Database Cleanup Script for Supabase OAuth Migration
-- ============================================================
-- This script removes custom LinkedIn OAuth tables that are
-- no longer needed after migrating to Supabase's built-in OAuth
--
-- ⚠️ WARNING: This will permanently delete these tables and all data
-- Only run this after confirming that:
-- 1. Supabase OAuth is working correctly
-- 2. All users have migrated to Supabase authentication
-- 3. You have backups if needed
-- ============================================================

-- Drop custom LinkedIn auth tables (if they exist)
DROP TABLE IF EXISTS linkedin_auth_sessions CASCADE;
DROP TABLE IF EXISTS linkedin_tokens CASCADE;

-- Drop custom users table (if you created one and it's no longer needed)
-- Uncomment the line below if you want to remove it
-- DROP TABLE IF EXISTS users CASCADE;

-- Verify tables have been dropped
-- Run this query to check remaining tables:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- ============================================================
-- After running this script, the database will only contain
-- Supabase's built-in auth tables:
-- - auth.users (managed by Supabase)
-- - auth.identities (managed by Supabase)
-- - auth.sessions (managed by Supabase)
--
-- Plus any application-specific tables you may have created
-- ============================================================
