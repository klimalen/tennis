-- Fix self-referential RLS on conversation_participants (causes infinite recursion)
-- Solution: security definer function that bypasses RLS to get user's conversation IDs

CREATE OR REPLACE FUNCTION my_conversation_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid();
$$;

-- Fix conversation_participants SELECT policy
DROP POLICY IF EXISTS "Participants see memberships" ON conversation_participants;
DROP POLICY IF EXISTS "Participants see all members of their conversations" ON conversation_participants;

CREATE POLICY "Participants see all members of their conversations"
  ON conversation_participants FOR SELECT
  USING (conversation_id IN (SELECT my_conversation_ids()));

-- Fix conversations SELECT policy (same issue — referenced conversation_participants with RLS)
DROP POLICY IF EXISTS "Participants see conversation" ON conversations;

CREATE POLICY "Participants see conversation"
  ON conversations FOR SELECT
  USING (id IN (SELECT my_conversation_ids()));
