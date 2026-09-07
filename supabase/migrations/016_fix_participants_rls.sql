-- Allow participants to see ALL members of their conversations (not just themselves)
DROP POLICY IF EXISTS "Participants see memberships" ON conversation_participants;

CREATE POLICY "Participants see all members of their conversations"
  ON conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
    )
  );
