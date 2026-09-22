-- Venue groups: one record per organization / facility that operates a set of courts.
--
-- Raw `venues` rows (one per OSM pitch polygon) stay as-is; they are attached to a
-- group via `venues.group_id`. The group is what the app shows as a "court card":
-- name of the organization, address, contacts, hours, court count, surface.

CREATE TABLE venue_groups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity (NULL until identified by a source)
  name                text,
  kind                text NOT NULL DEFAULT 'unknown'
                      CHECK (kind IN (
                        'public_park', 'tennis_center', 'club', 'school',
                        'residential', 'hotel', 'commercial', 'other', 'unknown'
                      )),

  -- Location: centroid of member courts
  lat                 double precision NOT NULL,
  lng                 double precision NOT NULL,
  location            geography(Point, 4326) GENERATED ALWAYS AS (
                        ST_SetSRID(ST_MakePoint(lng, lat), 4326)
                      ) STORED,
  address             text,

  -- Contacts & hours
  phone               text,
  website             text,
  opening_hours       text,
  description         text,

  -- Facility facts
  court_count         int  CHECK (court_count IS NULL OR court_count BETWEEN 1 AND 200),
  court_count_osm     int  NOT NULL DEFAULT 0,   -- derived: sum over member courts
  member_count        int  NOT NULL DEFAULT 0,   -- number of attached venues rows
  surface             text,                      -- normalized: hard | clay | grass | carpet | synthetic
  lit                 boolean,
  has_indoor          boolean,
  has_outdoor         boolean,
  access              text CHECK (access IS NULL OR access IN ('public', 'private', 'members', 'customers')),
  fee                 boolean,

  -- External references
  osm_parent_id       text,                      -- enclosing OSM feature, e.g. "way/123456"
  google_place_id     text,
  google_maps_uri     text,

  -- Provenance: array of {type, url, fetched_at, fields?}
  sources             jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence          text NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),

  -- Enrichment queue
  needs_enrichment    boolean NOT NULL DEFAULT true,
  enriched_at         timestamptz,
  enrichment_attempts int NOT NULL DEFAULT 0,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venue_groups_location ON venue_groups USING GIST (location);
CREATE INDEX idx_venue_groups_lat_lng  ON venue_groups (lat, lng);
CREATE INDEX idx_venue_groups_needs_enrichment
  ON venue_groups (needs_enrichment) WHERE needs_enrichment = true;
CREATE UNIQUE INDEX idx_venue_groups_google_place_id
  ON venue_groups (google_place_id) WHERE google_place_id IS NOT NULL;

CREATE TRIGGER venue_groups_updated_at
  BEFORE UPDATE ON venue_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Attach raw courts to a group
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES venue_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_venues_group_id ON venues (group_id);

-- RLS: public read, writes only via service role (scripts)
ALTER TABLE venue_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Venue groups viewable by everyone" ON venue_groups FOR SELECT USING (true);
