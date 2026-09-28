-- A game has one chat. Membership follows the seats: the organiser and every
-- accepted player. Someone who leaves loses access. A later player joins the
-- same chat but only sees messages from the stretches when they held a seat.
-- Personal chats stay separate and are never reused as a game chat.

ALTER TABLE conversations
  ADD COLUMN kind text NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct', 'game')),
  ADD COLUMN game_id uuid REFERENCES games(id) ON DELETE SET NULL,
  ADD COLUMN closed_at timestamptz;

CREATE UNIQUE INDEX conversations_one_game_chat
  ON conversations (game_id)
  WHERE game_id IS NOT NULL;

CREATE TABLE conversation_access_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX conversation_access_spans_member
  ON conversation_access_spans (conversation_id, user_id, joined_at);

ALTER TABLE conversation_access_spans ENABLE ROW LEVEL SECURITY;

-- Personal lookups must ignore a game chat the two people both sit in.
CREATE OR REPLACE FUNCTION shared_conversation_id(other_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cp1.conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
    AND c.kind = 'direct'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  IF auth.uid() IS NULL OR other_user_id IS NULL OR other_user_id = auth.uid() THEN
    RAISE EXCEPTION 'invalid conversation';
  END IF;

  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(LEAST(auth.uid(), other_user_id)::text || GREATEST(auth.uid(), other_user_id)::text), 1, 16))::bit(64)::bigint
  );

  SELECT cp1.conversation_id INTO v_conv_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  JOIN conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
    AND c.kind = 'direct'
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  v_conv_id := gen_random_uuid();
  INSERT INTO conversations (id, kind) VALUES (v_conv_id, 'direct');
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES
    (v_conv_id, auth.uid()),
    (v_conv_id, other_user_id);

  INSERT INTO follows (follower_id, following_id) VALUES
    (auth.uid(), other_user_id),
    (other_user_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN v_conv_id;
END;
$$;

REVOKE ALL ON FUNCTION get_or_create_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_or_create_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION can_read_message(p_conversation uuid, p_created timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = p_conversation AND cp.user_id = auth.uid()
  )
  AND (
    NOT EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = p_conversation AND c.kind = 'game'
    )
    OR EXISTS (
      SELECT 1 FROM conversation_access_spans s
      WHERE s.conversation_id = p_conversation
        AND s.user_id = auth.uid()
        AND p_created >= s.joined_at
        AND (s.left_at IS NULL OR p_created < s.left_at)
    )
  );
$$;

CREATE OR REPLACE FUNCTION can_send_message(p_conversation uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = p_conversation AND cp.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM conversations c
      LEFT JOIN games g ON g.id = c.game_id
      WHERE c.id = p_conversation
        AND c.kind = 'game'
        AND (c.closed_at IS NOT NULL OR g.status = 'cancelled')
    );
$$;

REVOKE ALL ON FUNCTION can_read_message(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION can_send_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_read_message(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION can_send_message(uuid) TO authenticated;

DROP POLICY IF EXISTS "Participants read messages" ON messages;
CREATE POLICY "Participants read messages"
  ON messages FOR SELECT
  USING (can_read_message(conversation_id, created_at));

DROP POLICY IF EXISTS "Participants send messages" ON messages;
CREATE POLICY "Participants send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND can_send_message(conversation_id));

CREATE OR REPLACE FUNCTION ensure_game_chat(p_game_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv uuid;
  v_creator uuid;
  v_member uuid;
  v_count int;
BEGIN
  SELECT creator_id INTO v_creator FROM games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_count FROM (
    SELECT v_creator AS user_id
    UNION
    SELECT player_id FROM game_participants
    WHERE game_id = p_game_id AND status = 'accepted'
  ) members;

  SELECT id INTO v_conv FROM conversations WHERE game_id = p_game_id;

  IF v_conv IS NULL THEN
    IF v_count < 2 THEN
      RETURN NULL;
    END IF;
    INSERT INTO conversations (kind, game_id) VALUES ('game', p_game_id) RETURNING id INTO v_conv;
  END IF;

  FOR v_member IN
    SELECT v_creator
    UNION
    SELECT player_id FROM game_participants
    WHERE game_id = p_game_id AND status = 'accepted'
  LOOP
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv, v_member)
    ON CONFLICT DO NOTHING;

    IF NOT EXISTS (
      SELECT 1 FROM conversation_access_spans
      WHERE conversation_id = v_conv AND user_id = v_member AND left_at IS NULL
    ) THEN
      INSERT INTO conversation_access_spans (conversation_id, user_id)
      VALUES (v_conv, v_member);
    END IF;
  END LOOP;

  FOR v_member IN
    SELECT cp.user_id
    FROM conversation_participants cp
    WHERE cp.conversation_id = v_conv
      AND cp.user_id <> v_creator
      AND NOT EXISTS (
        SELECT 1 FROM game_participants gp
        WHERE gp.game_id = p_game_id
          AND gp.player_id = cp.user_id
          AND gp.status = 'accepted'
      )
  LOOP
    UPDATE conversation_access_spans
    SET left_at = now()
    WHERE conversation_id = v_conv AND user_id = v_member AND left_at IS NULL;

    DELETE FROM conversation_participants
    WHERE conversation_id = v_conv AND user_id = v_member;
  END LOOP;

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION ensure_game_chat(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game_participants_sync_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM ensure_game_chat(COALESCE(NEW.game_id, OLD.game_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS game_participants_sync_chat ON game_participants;
CREATE TRIGGER game_participants_sync_chat
  AFTER INSERT OR UPDATE OF status OR DELETE ON game_participants
  FOR EACH ROW EXECUTE FUNCTION game_participants_sync_chat();

CREATE OR REPLACE FUNCTION close_chat_on_game_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET closed_at = COALESCE(closed_at, now())
  WHERE game_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS close_chat_on_game_delete ON games;
CREATE TRIGGER close_chat_on_game_delete
  BEFORE DELETE ON games
  FOR EACH ROW EXECUTE FUNCTION close_chat_on_game_delete();

-- Open a chat for games that already have a second player.
DO $$
DECLARE
  v_game uuid;
BEGIN
  FOR v_game IN
    SELECT g.id
    FROM games g
    WHERE g.status NOT IN ('cancelled', 'draft')
      AND (
        SELECT count(*) FROM (
          SELECT g.creator_id AS user_id
          UNION
          SELECT gp.player_id FROM game_participants gp
          WHERE gp.game_id = g.id AND gp.status = 'accepted'
        ) members
      ) >= 2
  LOOP
    PERFORM ensure_game_chat(v_game);
  END LOOP;
END $$;
