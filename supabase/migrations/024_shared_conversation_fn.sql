-- Helper to find a shared 1:1 conversation between the current user and another user.
-- SECURITY DEFINER bypasses RLS (same pattern as my_conversation_ids).
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
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
  LIMIT 1;
$$;
