-- Add city_name to profiles (text, free-form from onboarding)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city_name text;

-- Venues: OSM-sourced public tennis facilities
CREATE TABLE venues (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  osm_id          text UNIQUE NOT NULL,
  name            text NOT NULL,
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  location        geography(Point, 4326) GENERATED ALWAYS AS (
                    ST_SetSRID(ST_MakePoint(lng, lat), 4326)
                  ) STORED,
  address         text,
  surface         text,          -- clay, hard, grass, etc (raw OSM value)
  court_count     int,
  lit             boolean,
  access          text,          -- public, private, members
  fee             boolean,
  website         text,
  phone           text,
  operator        text,
  opening_hours   text,
  osm_fetched_at  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venues_location ON venues USING GIST (location);
CREATE INDEX idx_venues_osm_id ON venues (osm_id);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venues viewable by everyone" ON venues FOR SELECT USING (true);
