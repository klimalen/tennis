-- Enable realtime for games table so invite cards update live when game is edited
ALTER TABLE games REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
