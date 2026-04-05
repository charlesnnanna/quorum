-- ============================================================
-- Quorum — Initial Database Migration
-- Run this in the Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLES
-- ────────────────────────────────────────────────────────────

-- Profiles: public user data, linked to Supabase auth.users
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text UNIQUE NOT NULL,
  full_name   text,
  avatar_url  text,
  is_online   boolean DEFAULT false,
  last_seen   timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

-- Rooms: chat channels / conversations
CREATE TABLE rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_private  boolean DEFAULT false,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

-- Room members: junction table for room membership
CREATE TABLE room_members (
  room_id   uuid REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role      text DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- Messages: all chat messages (human and AI)
CREATE TABLE messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id   uuid REFERENCES profiles(id),  -- NULL for AI messages
  sender_type text NOT NULL CHECK (sender_type IN ('human', 'ai')),
  content     text NOT NULL DEFAULT '',
  status      text DEFAULT 'delivered' CHECK (status IN ('sending', 'delivered', 'error')),
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ────────────────────────────────────────────────────────────

-- Fast message lookups by room, ordered by time (chat scroll)
CREATE INDEX idx_messages_room_created ON messages (room_id, created_at DESC);

-- Fast membership checks (used in every RLS policy)
CREATE INDEX idx_room_members_user ON room_members (user_id);
CREATE INDEX idx_room_members_room ON room_members (room_id);

-- Fast profile lookup by username (for @mentions, invites)
CREATE INDEX idx_profiles_username ON profiles (username);

-- ────────────────────────────────────────────────────────────
-- 3. AUTO-CREATE PROFILE ON SIGNUP
-- ────────────────────────────────────────────────────────────

-- When a new user signs up via auth.users (triggered by BetterAuth
-- or Supabase Auth), automatically create a profiles row.
-- Username is derived from email (before @), made unique with a random suffix.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
BEGIN
  -- Extract username from email, fallback to 'user'
  base_username := COALESCE(
    split_part(NEW.email, '@', 1),
    'user'
  );

  -- Remove non-alphanumeric characters and truncate
  base_username := regexp_replace(base_username, '[^a-zA-Z0-9_]', '', 'g');
  base_username := left(base_username, 20);

  -- If empty after cleanup, use 'user'
  IF base_username = '' THEN
    base_username := 'user';
  END IF;

  -- Try the base username first, append random suffix if taken
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    final_username := base_username || '_' || floor(random() * 10000)::text;
  END LOOP;

  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );

  RETURN NEW;
END;
$$;

-- Fire after every new signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 4. AUTO-UPDATE updated_at ON MESSAGES
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 5. ENABLE ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 6. RLS POLICIES — profiles
-- ────────────────────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can read profiles of people in their rooms
CREATE POLICY "Users can read room member profiles"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT rm2.user_id
      FROM room_members rm1
      JOIN room_members rm2 ON rm1.room_id = rm2.room_id
      WHERE rm1.user_id = auth.uid()
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 7. RLS POLICIES — rooms
-- ────────────────────────────────────────────────────────────

-- Users can see rooms they are members of
CREATE POLICY "Members can read their rooms"
  ON rooms FOR SELECT
  USING (
    id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can see public rooms (for discovery / joining)
CREATE POLICY "Anyone can read public rooms"
  ON rooms FOR SELECT
  USING (is_private = false);

-- Authenticated users can create rooms
CREATE POLICY "Authenticated users can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Room owners can update their rooms
CREATE POLICY "Owners can update their rooms"
  ON rooms FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Room owners can delete their rooms
CREATE POLICY "Owners can delete their rooms"
  ON rooms FOR DELETE
  USING (created_by = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 8. RLS POLICIES — room_members
-- ────────────────────────────────────────────────────────────

-- Members can see who else is in their rooms
CREATE POLICY "Members can read room membership"
  ON room_members FOR SELECT
  USING (
    room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid()
    )
  );

-- Room owners can add members
CREATE POLICY "Owners can add members"
  ON room_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = room_members.room_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- Users can add themselves to public rooms (join)
CREATE POLICY "Users can join public rooms"
  ON room_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rooms
      WHERE id = room_id AND is_private = false
    )
  );

-- The room creator can add themselves as owner (during room creation)
CREATE POLICY "Creator can add self as owner"
  ON room_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM rooms
      WHERE id = room_id AND created_by = auth.uid()
    )
  );

-- Room owners can remove members
CREATE POLICY "Owners can remove members"
  ON room_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM room_members owner_check
      WHERE owner_check.room_id = room_members.room_id
        AND owner_check.user_id = auth.uid()
        AND owner_check.role = 'owner'
    )
  );

-- Users can leave rooms (remove themselves)
CREATE POLICY "Users can leave rooms"
  ON room_members FOR DELETE
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 9. RLS POLICIES — messages
-- ────────────────────────────────────────────────────────────

-- Users can read messages only from rooms they are members of
CREATE POLICY "Members can read room messages"
  ON messages FOR SELECT
  USING (
    room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert human messages as themselves
CREATE POLICY "Users can send messages as themselves"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_type = 'human'
    AND room_id IN (
      SELECT room_id FROM room_members
      WHERE user_id = auth.uid()
    )
  );

-- AI messages are inserted by the service role only.
-- No RLS policy needed — service role bypasses RLS entirely.
-- This is enforced by architecture: the AI route handler uses
-- the SUPABASE_SERVICE_ROLE_KEY, which skips all policies.

-- Users can update their own messages (edit content)
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid() AND sender_type = 'human')
  WITH CHECK (sender_id = auth.uid() AND sender_type = 'human');

-- ────────────────────────────────────────────────────────────
-- 10. FUNCTION: get_user_rooms
-- Returns all rooms a user belongs to, with last message + member count
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_rooms(p_user_id uuid)
RETURNS TABLE (
  room_id          uuid,
  room_name        text,
  room_description text,
  is_private       boolean,
  created_by       uuid,
  room_created_at  timestamptz,
  user_role        text,
  member_count     bigint,
  last_message_id       uuid,
  last_message_content  text,
  last_message_sender   uuid,
  last_message_type     text,
  last_message_at       timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    r.id              AS room_id,
    r.name            AS room_name,
    r.description     AS room_description,
    r.is_private,
    r.created_by,
    r.created_at      AS room_created_at,
    rm.role           AS user_role,
    mc.member_count,
    lm.id             AS last_message_id,
    lm.content        AS last_message_content,
    lm.sender_id      AS last_message_sender,
    lm.sender_type    AS last_message_type,
    lm.created_at     AS last_message_at
  FROM room_members rm
  JOIN rooms r ON r.id = rm.room_id
  -- Member count per room
  LEFT JOIN LATERAL (
    SELECT count(*) AS member_count
    FROM room_members
    WHERE room_id = r.id
  ) mc ON true
  -- Last message per room
  LEFT JOIN LATERAL (
    SELECT m.id, m.content, m.sender_id, m.sender_type, m.created_at
    FROM messages m
    WHERE m.room_id = r.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE rm.user_id = p_user_id
  ORDER BY COALESCE(lm.created_at, r.created_at) DESC;
$$;

-- ────────────────────────────────────────────────────────────
-- 11. ENABLE REALTIME
-- Required for Supabase Realtime subscriptions on these tables
-- ────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
