-- Complete Database Setup for Beacon Flow
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Base Authentication Tables
-- ============================================

-- Drop sequences if they exist
DROP SEQUENCE IF EXISTS m_users_id_seq CASCADE;
DROP SEQUENCE IF EXISTS m_roles_id_seq CASCADE;
DROP SEQUENCE IF EXISTS m_refresh_tokens_id_seq CASCADE;

-- Create sequences
CREATE SEQUENCE m_users_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE m_roles_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE m_refresh_tokens_id_seq START WITH 1 INCREMENT BY 1;

-- Master Table: User Management
CREATE TABLE IF NOT EXISTS m_users (
    id INT PRIMARY KEY DEFAULT nextval('m_users_id_seq'),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    linkedin_id VARCHAR(255) UNIQUE NULL,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    updated_by INT NULL
);

-- Add self-referential foreign keys after table creation
ALTER TABLE m_users DROP CONSTRAINT IF EXISTS fk_users_created_by;
ALTER TABLE m_users DROP CONSTRAINT IF EXISTS fk_users_updated_by;
ALTER TABLE m_users ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES m_users(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE m_users ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES m_users(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- Master Table: Roles
CREATE TABLE IF NOT EXISTS m_roles (
    id INT PRIMARY KEY DEFAULT nextval('m_roles_id_seq'),
    role_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES m_users(id) NULL,
    updated_by INT REFERENCES m_users(id) NULL
);

-- Junction Table: Links Users to Roles
CREATE TABLE IF NOT EXISTS m_user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES m_users(id) NULL,
    updated_by INT REFERENCES m_users(id) NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES m_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES m_roles(id) ON DELETE CASCADE
);

-- Master Table: Refresh Tokens
CREATE TABLE IF NOT EXISTS m_refresh_tokens (
    id INT PRIMARY KEY DEFAULT nextval('m_refresh_tokens_id_seq'),
    user_id INT NOT NULL,
    refresh_token VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES m_users(id) NULL,
    updated_by INT REFERENCES m_users(id) NULL,
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES m_users(id) ON DELETE CASCADE
);

-- Insert default roles (if they don't exist)
INSERT INTO m_roles (role_name, created_at, updated_at)
VALUES ('admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO m_roles (role_name, created_at, updated_at)
VALUES ('user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role_name) DO NOTHING;

-- ============================================
-- PART 2: LinkedIn OAuth Tables
-- ============================================

-- Drop sequences if they exist
DROP SEQUENCE IF EXISTS linkedin_auth_sessions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS linkedin_tokens_id_seq CASCADE;

-- Create sequences
CREATE SEQUENCE linkedin_auth_sessions_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE linkedin_tokens_id_seq START WITH 1 INCREMENT BY 1;

-- LinkedIn Auth Sessions Table (for OAuth state tracking)
CREATE TABLE IF NOT EXISTS linkedin_auth_sessions (
    id INT PRIMARY KEY DEFAULT nextval('linkedin_auth_sessions_id_seq'),
    user_id INT NULL REFERENCES m_users(id) ON DELETE CASCADE,
    state VARCHAR(255) NOT NULL UNIQUE,
    code_verifier VARCHAR(255) NULL,
    return_url VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_linkedin_auth_sessions_state ON linkedin_auth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_linkedin_auth_sessions_created_at ON linkedin_auth_sessions(created_at);

-- LinkedIn Tokens Table (stores user's LinkedIn access tokens)
CREATE TABLE IF NOT EXISTS linkedin_tokens (
    id INT PRIMARY KEY DEFAULT nextval('linkedin_tokens_id_seq'),
    user_id INT NOT NULL UNIQUE REFERENCES m_users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    expires_at TIMESTAMP NOT NULL,
    scope VARCHAR(500) NOT NULL,
    linkedin_id VARCHAR(255) NULL UNIQUE,
    linkedin_email VARCHAR(255) NULL,
    linkedin_name VARCHAR(255) NULL,
    linkedin_picture VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_linkedin_tokens_user_id ON linkedin_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_tokens_linkedin_id ON linkedin_tokens(linkedin_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_tokens_expires_at ON linkedin_tokens(expires_at);

-- Comments
COMMENT ON TABLE linkedin_auth_sessions IS 'Temporary OAuth state tracking for LinkedIn authentication flow';
COMMENT ON TABLE linkedin_tokens IS 'Stores LinkedIn OAuth tokens and user profile information';
COMMENT ON COLUMN linkedin_tokens.access_token IS 'LinkedIn OAuth 2.0 access token (encrypted in production)';
COMMENT ON COLUMN linkedin_tokens.linkedin_id IS 'LinkedIn user ID (sub claim from userinfo endpoint)';

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Database setup complete! All tables created successfully.';
END $$;
