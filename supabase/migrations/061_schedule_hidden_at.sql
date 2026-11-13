-- Soft-dismiss past games from a player's own schedule/profile without
-- deleting the shared games row. Other participants keep seeing it.

ALTER TABLE game_participants
  ADD COLUMN IF NOT EXISTS schedule_hidden_at timestamptz NULL;

COMMENT ON COLUMN game_participants.schedule_hidden_at IS
  'When set, this player has removed the past game from their own schedule/profile. The game row remains for others.';

CREATE INDEX IF NOT EXISTS idx_game_participants_player_visible
  ON game_participants (player_id)
  WHERE schedule_hidden_at IS NULL;

-- Existing "Participant can update own status" already allows auth.uid() = player_id
-- updates, including schedule_hidden_at. Creators without a row can INSERT via
-- "Creator can insert participants" (my_created_game_ids).
