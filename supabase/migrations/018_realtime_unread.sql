-- Enable real-time for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Track when each participant last read a conversation (for unread badge)
ALTER TABLE conversation_participants
  ADD COLUMN last_read_at timestamptz;

-- Allow participants to update their own last_read_at
CREATE POLICY "Participants update own read timestamp"
  ON conversation_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
