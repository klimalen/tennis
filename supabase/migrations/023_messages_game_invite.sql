-- Add type and game_id to messages
ALTER TABLE messages ADD COLUMN type message_type NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN game_id uuid REFERENCES games(id) ON DELETE SET NULL;

CREATE INDEX idx_messages_game_id ON messages(game_id) WHERE game_id IS NOT NULL;

-- Add realtime for game_participants so invite cards update live
ALTER TABLE game_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE game_participants;
