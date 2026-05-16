-- Avatar Builder schema
-- One in-progress session per device while building; one active avatar per device once complete.

CREATE TABLE IF NOT EXISTS public.m_avatar_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       character varying(36) NOT NULL,
  current_step_id TEXT NOT NULL,
  status          SMALLINT NOT NULL DEFAULT 1, -- 1=in_progress, 2=complete, 3=abandoned
  answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  message_log     JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_data     JSONB NOT NULL DEFAULT '[]'::jsonb,
  patterns        JSONB NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avatar_sessions_device_status
  ON public.m_avatar_sessions (device_id, status);

CREATE TABLE IF NOT EXISTS public.m_user_avatars (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         character varying(36) NOT NULL UNIQUE,
  session_id        UUID NULL REFERENCES public.m_avatar_sessions(id) ON DELETE SET NULL,
  wake_up_thought   TEXT NOT NULL,
  backstory         TEXT NULL,
  viewer            JSONB NOT NULL DEFAULT '{}'::jsonb,
  generational      JSONB NOT NULL DEFAULT '{}'::jsonb,
  brain_wiring      JSONB NOT NULL DEFAULT '{}'::jsonb,
  drivers           JSONB NOT NULL DEFAULT '{}'::jsonb,
  anti_identity     JSONB NOT NULL DEFAULT '{}'::jsonb,
  heroes            JSONB NOT NULL DEFAULT '[]'::jsonb,
  voc_phrases       JSONB NOT NULL DEFAULT '[]'::jsonb,
  stop_scroll       JSONB NOT NULL DEFAULT '[]'::jsonb,
  patterns          JSONB NULL,
  markdown          TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_avatars_device
  ON public.m_user_avatars (device_id);
