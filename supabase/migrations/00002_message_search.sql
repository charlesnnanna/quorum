-- ============================================================
-- Quorum — Full-Text Search on Messages
-- Adds a generated tsvector column, GIN index, and search RPC.
-- Run in Supabase SQL Editor or via supabase db push.
-- ============================================================

-- 1. Add a generated tsvector column for FTS
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

-- 2. GIN index for fast full-text lookups
CREATE INDEX IF NOT EXISTS idx_messages_content_fts
  ON messages USING GIN (content_tsv);

-- 3. RPC function: search messages in a room
--    Returns matching messages with sender profile info.
--    Uses websearch_to_tsquery for natural-language queries
--    (supports "quoted phrases", OR, - for exclusion).
--    Results are ranked by relevance, capped at 50.

CREATE OR REPLACE FUNCTION search_messages(
  p_room_id  uuid,
  p_query    text,
  p_limit    int DEFAULT 50
)
RETURNS TABLE (
  id          uuid,
  room_id     uuid,
  sender_id   uuid,
  sender_type text,
  content     text,
  status      text,
  metadata    jsonb,
  created_at  timestamptz,
  updated_at  timestamptz,
  rank        real,
  sender_username  text,
  sender_avatar    text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    m.id,
    m.room_id,
    m.sender_id,
    m.sender_type,
    m.content,
    m.status,
    m.metadata,
    m.created_at,
    m.updated_at,
    ts_rank(m.content_tsv, websearch_to_tsquery('english', p_query)) AS rank,
    p.username   AS sender_username,
    p.avatar_url AS sender_avatar
  FROM messages m
  LEFT JOIN profiles p ON p.id = m.sender_id
  WHERE m.room_id = p_room_id
    AND m.content_tsv @@ websearch_to_tsquery('english', p_query)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT p_limit;
$$;
