CREATE TABLE clubs (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              text NOT NULL,
  slug              text UNIQUE NOT NULL,
  description       text,
  location          geography(Point, 4326) NOT NULL,
  address           text NOT NULL,
  city_id           uuid REFERENCES cities(id),
  phone             text,
  email             text,
  website           text,
  logo_url          text,
  cover_url         text,
  amenities         text[] NOT NULL DEFAULT '{}',
  rating            numeric(3,2),
  total_reviews     int NOT NULL DEFAULT 0,
  stripe_account_id text,
  owner_id          uuid NOT NULL REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX idx_clubs_location ON clubs USING GIST (location);
CREATE INDEX idx_clubs_city     ON clubs (city_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clubs_slug     ON clubs (slug);

CREATE TRIGGER clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE club_media (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id    uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  url        text NOT NULL,
  "order"    int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courts (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id              uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  surface              surface_type NOT NULL,
  environment          court_environment NOT NULL,
  has_lighting         boolean NOT NULL DEFAULT false,
  price_per_hour       numeric NOT NULL CHECK (price_per_hour >= 0),
  currency             text NOT NULL DEFAULT 'USD',
  min_duration_minutes int NOT NULL DEFAULT 60,
  max_players          int NOT NULL DEFAULT 4,
  is_active            boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_courts_club ON courts (club_id) WHERE is_active = true;

CREATE TABLE court_slots (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  court_id       uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  status         slot_status NOT NULL DEFAULT 'available',
  price_override numeric,
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_court_slots_available ON court_slots (court_id, status, starts_at)
  WHERE status = 'available';

ALTER TABLE clubs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_media  ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clubs viewable by everyone"  ON clubs      FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Club media viewable"         ON club_media FOR SELECT USING (true);
CREATE POLICY "Courts viewable by everyone" ON courts     FOR SELECT USING (is_active = true);
CREATE POLICY "Slots viewable by everyone"  ON court_slots FOR SELECT USING (true);

CREATE POLICY "Club owners manage clubs"
  ON clubs FOR ALL USING (auth.uid() = owner_id);
