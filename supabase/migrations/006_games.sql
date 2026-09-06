CREATE TABLE games (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id       uuid NOT NULL REFERENCES profiles(id),
  sport            sport_type NOT NULL DEFAULT 'tennis',
  format           play_format NOT NULL DEFAULT 'singles',
  play_style       play_style NOT NULL DEFAULT 'recreational',
  skill_level_min  numeric(3,1) NOT NULL CHECK (skill_level_min BETWEEN 1.0 AND 7.0),
  skill_level_max  numeric(3,1) NOT NULL CHECK (skill_level_max BETWEEN 1.0 AND 7.0),
  scheduled_at     timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 90 CHECK (duration_minutes > 0),
  location         geography(Point, 4326),
  city_id          uuid REFERENCES cities(id),
  neighborhood     text,
  court_id         uuid REFERENCES courts(id),
  court_booking_id uuid,
  status           game_status NOT NULL DEFAULT 'draft',
  is_open          boolean NOT NULL DEFAULT false,
  max_players      int NOT NULL DEFAULT 2,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (skill_level_max >= skill_level_min)
);

CREATE INDEX idx_games_location     ON games USING GIST (location);
CREATE INDEX idx_games_status_sched ON games (status, scheduled_at);
CREATE INDEX idx_games_city_open    ON games (city_id, is_open, scheduled_at) WHERE is_open = true;
CREATE INDEX idx_games_creator      ON games (creator_id);

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE game_participants (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id      uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id    uuid NOT NULL REFERENCES profiles(id),
  status       participant_status NOT NULL DEFAULT 'invited',
  team         int CHECK (team IN (1, 2)),
  invited_at   timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (game_id, player_id)
);

CREATE INDEX idx_game_participants_game   ON game_participants (game_id);
CREATE INDEX idx_game_participants_player ON game_participants (player_id);

CREATE TABLE match_results (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id      uuid NOT NULL UNIQUE REFERENCES games(id),
  winner_id    uuid REFERENCES profiles(id),
  winning_team int CHECK (winning_team IN (1, 2)),
  status       result_status NOT NULL DEFAULT 'pending',
  submitted_by uuid NOT NULL REFERENCES profiles(id),
  confirmed_by uuid REFERENCES profiles(id),
  played_at    timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER match_results_updated_at
  BEFORE UPDATE ON match_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE match_sets (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_result_id uuid NOT NULL REFERENCES match_results(id) ON DELETE CASCADE,
  set_number      int NOT NULL,
  score_p1        int NOT NULL CHECK (score_p1 >= 0),
  score_p2        int NOT NULL CHECK (score_p2 >= 0),
  tiebreak_p1     int,
  tiebreak_p2     int,
  UNIQUE (match_result_id, set_number)
);

ALTER TABLE games             ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_sets        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open games viewable by everyone"
  ON games FOR SELECT USING (is_open = true OR auth.uid() = creator_id OR auth.uid() IN (
    SELECT player_id FROM game_participants WHERE game_id = games.id
  ));

CREATE POLICY "Participants view game participants"
  ON game_participants FOR SELECT USING (
    auth.uid() = player_id OR
    auth.uid() IN (SELECT player_id FROM game_participants gp WHERE gp.game_id = game_participants.game_id)
  );

CREATE POLICY "Match results viewable by everyone" ON match_results FOR SELECT USING (true);
CREATE POLICY "Match sets viewable by everyone"    ON match_sets    FOR SELECT USING (true);
