-- follows table already exists from a prior migration.
-- Update get_or_create_conversation to auto mutual-follow on first match.

CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
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

  -- Create conversation
  v_conv_id := gen_random_uuid();
  INSERT INTO conversations (id) VALUES (v_conv_id);
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES
    (v_conv_id, auth.uid()),
    (v_conv_id, other_user_id);

  -- Auto mutual follow on first match
  INSERT INTO follows (follower_id, following_id) VALUES
    (auth.uid(), other_user_id),
    (other_user_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN v_conv_id;
END;
$$;
