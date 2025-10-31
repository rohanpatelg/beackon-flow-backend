-- LinkedIn OAuth Tables for Beacon Flow Backend

-- Drop sequences if they exist
DROP SEQUENCE IF EXISTS linkedin_auth_sessions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS linkedin_tokens_id_seq CASCADE;

-- Create sequences
CREATE SEQUENCE linkedin_auth_sessions_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE linkedin_tokens_id_seq START WITH 1 INCREMENT BY 1;

-- LinkedIn Auth Sessions Table (for OAuth state tracking)
CREATE TABLE linkedin_auth_sessions (
    id INT PRIMARY KEY DEFAULT nextval('linkedin_auth_sessions_id_seq'),
    user_id INT NULL REFERENCES m_users(id) ON DELETE CASCADE,
    state VARCHAR(255) NOT NULL UNIQUE,
    code_verifier VARCHAR(255) NULL,
    return_url VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_linkedin_auth_sessions_state ON linkedin_auth_sessions(state);
CREATE INDEX idx_linkedin_auth_sessions_created_at ON linkedin_auth_sessions(created_at);

-- LinkedIn Tokens Table (stores user's LinkedIn access tokens)
CREATE TABLE linkedin_tokens (
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

CREATE INDEX idx_linkedin_tokens_user_id ON linkedin_tokens(user_id);
CREATE INDEX idx_linkedin_tokens_linkedin_id ON linkedin_tokens(linkedin_id);
CREATE INDEX idx_linkedin_tokens_expires_at ON linkedin_tokens(expires_at);

-- Add LinkedIn ID to m_users table (optional, for linking)
ALTER TABLE m_users ADD COLUMN linkedin_id VARCHAR(255) UNIQUE NULL;

COMMENT ON TABLE linkedin_auth_sessions IS 'Temporary OAuth state tracking for LinkedIn authentication flow';
COMMENT ON TABLE linkedin_tokens IS 'Stores LinkedIn OAuth tokens and user profile information';
COMMENT ON COLUMN linkedin_tokens.access_token IS 'LinkedIn OAuth 2.0 access token (encrypted in production)';
COMMENT ON COLUMN linkedin_tokens.linkedin_id IS 'LinkedIn user ID (sub claim from userinfo endpoint)';
