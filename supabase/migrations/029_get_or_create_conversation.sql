-- Atomically find or create a 1:1 conversation between auth.uid() and other_user_id.
-- Prevents duplicate conversations regardless of which code path calls it.
-- Returns the existing conversation_id if one already exists, otherwise creates
-- a new conversation + two participant rows and returns the new id.
CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  -- Lock the smaller uuid first to prevent deadlocks between concurrent callers
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(LEAST(auth.uid(), other_user_id)::text || GREATEST(auth.uid(), other_user_id)::text), 1, 16))::bit(64)::bigint
  );

  -- Check for existing conversation
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

  -- Create new
  v_conv_id := gen_random_uuid();
  INSERT INTO conversations (id) VALUES (v_conv_id);
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES
    (v_conv_id, auth.uid()),
    (v_conv_id, other_user_id);

  RETURN v_conv_id;
END;
$$;
