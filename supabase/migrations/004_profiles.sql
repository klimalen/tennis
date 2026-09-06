CREATE TABLE profiles (
  id                        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username                  text UNIQUE NOT NULL,
  full_name                 text NOT NULL,
  avatar_url                text,
  bio                       text,
  birth_year                int,
  gender                    text,
  location                  geography(Point, 4326),
  city_id                   uuid REFERENCES cities(id),
  neighborhood              text,
  sport                     sport_type NOT NULL DEFAULT 'tennis',
  skill_level_self          numeric(3,1) CHECK (skill_level_self BETWEEN 1.0 AND 7.0),
  skill_level_computed      numeric(3,1) CHECK (skill_level_computed BETWEEN 1.0 AND 7.0),
  skill_level_verified_by   uuid REFERENCES profiles(id),
  years_playing             int CHECK (years_playing >= 0),
  preferred_surfaces        surface_type[] NOT NULL DEFAULT '{}',
  preferred_formats         play_format[] NOT NULL DEFAULT '{}',
  play_style                play_style,
  preferred_days            int[] NOT NULL DEFAULT '{}',
  preferred_time_start      time,
  preferred_time_end        time,
  max_travel_km             int CHECK (max_travel_km > 0),
  looking_for               text,
  is_coach                  boolean NOT NULL DEFAULT false,
  is_club_manager           boolean NOT NULL DEFAULT false,
  reliability_score         numeric(5,2) CHECK (reliability_score BETWEEN 0 AND 100),
  total_matches             int NOT NULL DEFAULT 0,
  identity_verified         boolean NOT NULL DEFAULT false,
  stripe_customer_id        text,
  last_active_at            timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  deleted_at                timestamptz
);

CREATE INDEX idx_profiles_location ON profiles USING GIST (location);
CREATE INDEX idx_profiles_skill    ON profiles (skill_level_computed, sport) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_city     ON profiles (city_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_username ON profiles (username);
CREATE INDEX idx_profiles_coach    ON profiles (is_coach) WHERE is_coach = true AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TABLE coach_profiles (
  id                uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tagline           text,
  experience_years  int CHECK (experience_years >= 0),
  certifications    text[] NOT NULL DEFAULT '{}',
  specializations   text[] NOT NULL DEFAULT '{}',
  teaches_levels    numeric[] NOT NULL DEFAULT '{}',
  languages         text[] NOT NULL DEFAULT '{}',
  hourly_rate       numeric CHECK (hourly_rate >= 0),
  currency          text NOT NULL DEFAULT 'USD',
  stripe_account_id text,
  rating            numeric(3,2),
  total_reviews     int NOT NULL DEFAULT 0,
  video_intro_url   text
);

CREATE TABLE follows (
  follower_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX idx_follows_following ON follows (following_id);

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Coach profiles viewable by everyone"
  ON coach_profiles FOR SELECT USING (true);

CREATE POLICY "Coaches manage own profile"
  ON coach_profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Follows viewable by everyone"
  ON follows FOR SELECT USING (true);

CREATE POLICY "Users manage own follows"
  ON follows FOR ALL USING (auth.uid() = follower_id);
