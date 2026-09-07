-- Enable realtime for read receipt updates
ALTER TABLE conversation_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
