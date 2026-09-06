CREATE TABLE player_skill_history (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sport       sport_type NOT NULL DEFAULT 'tennis',
  rating      numeric(5,1) NOT NULL,
  delta       numeric(5,1) NOT NULL DEFAULT 0,
  game_id     uuid REFERENCES games(id),
  reason      skill_reason NOT NULL DEFAULT 'match',
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_skill_history_player ON player_skill_history (player_id, computed_at DESC);
