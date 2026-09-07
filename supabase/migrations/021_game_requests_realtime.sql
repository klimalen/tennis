ALTER TABLE game_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE game_requests;
