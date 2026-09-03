-- Create enum type for event levels
CREATE TYPE event_level AS ENUM ('debug', 'info', 'warning', 'error', 'fatal');

-- Create extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create events table
CREATE TABLE events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level        event_level  NOT NULL,
  message      TEXT         NOT NULL,
  source       TEXT         NOT NULL,
  timestamp    TIMESTAMPTZ  NOT NULL,
  received_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Cursor index: pagination order (most recent first)
CREATE INDEX idx_events_cursor ON events (received_at DESC, id DESC);

-- Level + cursor index: filter by level with proper ordering
CREATE INDEX idx_events_level_cursor ON events (level, received_at DESC, id DESC);

-- Timestamp range filter
CREATE INDEX idx_events_timestamp ON events (timestamp DESC);

-- Full-text search on message
CREATE INDEX idx_events_message_trgm ON events USING gin (message gin_trgm_ops);

-- Source filter
CREATE INDEX idx_events_source ON events (source);
