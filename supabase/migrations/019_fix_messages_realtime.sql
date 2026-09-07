-- Include all columns in logical replication stream (required for realtime filters)
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Simplify messages SELECT policy to use security definer function
-- (avoids nested RLS check that breaks realtime delivery)
DROP POLICY IF EXISTS "Participants read messages" ON messages;

CREATE POLICY "Participants read messages"
  ON messages FOR SELECT
  USING (conversation_id IN (SELECT my_conversation_ids()));
