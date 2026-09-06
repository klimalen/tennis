CREATE TABLE cities (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  country_code text NOT NULL,
  location     geography(Point, 4326) NOT NULL,
  timezone     text NOT NULL,
  is_active    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cities_location ON cities USING GIST (location);
CREATE INDEX idx_cities_active ON cities (is_active) WHERE is_active = true;
