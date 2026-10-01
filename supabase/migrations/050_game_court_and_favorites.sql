-- A game can point at a catalog court, and the host can say what the hour costs
-- and how players settle it. The app does not take payment.
-- Players can star courts they actually use.

ALTER TABLE games
  ADD COLUMN venue_group_id uuid REFERENCES venue_groups(id) ON DELETE SET NULL,
  ADD COLUMN court_cost_cents integer CHECK (court_cost_cents IS NULL OR court_cost_cents >= 0),
  ADD COLUMN payment text CHECK (payment IS NULL OR payment IN ('split', 'host', 'at_court'));

CREATE INDEX idx_games_venue_group_id ON games (venue_group_id);

CREATE TABLE court_favorites (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_group_id uuid NOT NULL REFERENCES venue_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, venue_group_id)
);

ALTER TABLE court_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own court favorites"
  ON court_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insert own court favorites"
  ON court_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Delete own court favorites"
  ON court_favorites FOR DELETE
  USING (auth.uid() = user_id);
