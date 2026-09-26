-- A mutual game consent opens a chat through get_or_create_conversation.
-- Migration 032 also made that pair follow each other. Migration 041 rewrote
-- the function for its security checks and dropped those inserts, so a chat
-- could open while one existing follow left the composer locked
-- ("Messaging requires a mutual follow"). Restore both follows when the chat
-- is created. Joining a public game (join_open_game) still does not follow.

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
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  v_conv_id := gen_random_uuid();
  INSERT INTO conversations (id) VALUES (v_conv_id);
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

-- People who already matched are stuck on the locked composer until both
-- follow rows exist. Fill any missing direction for existing 1:1 chats.
-- The follow trigger would notify "X followed you" for each repaired row;
-- skip it for this backfill only. New matches still notify.
ALTER TABLE follows DISABLE TRIGGER follows_notify;

INSERT INTO follows (follower_id, following_id)
SELECT a.user_id, b.user_id
FROM conversation_participants a
JOIN conversation_participants b
  ON b.conversation_id = a.conversation_id
 AND b.user_id <> a.user_id
WHERE (
  SELECT count(*)
  FROM conversation_participants cp
  WHERE cp.conversation_id = a.conversation_id
) = 2
ON CONFLICT DO NOTHING;

ALTER TABLE follows ENABLE TRIGGER follows_notify;
