-- Venue catalog: enrich venues table for pre-populated city catalog
-- Allows non-OSM sources (Austin Open Data, Geoapify) + browser agent enrichment queue

-- osm_id becomes nullable: non-OSM venues use synthetic IDs like "austin_od:1"
-- The UNIQUE constraint stays — NULLs are allowed (Postgres NULLs != NULLs in UNIQUE)
ALTER TABLE venues ALTER COLUMN osm_id DROP NOT NULL;

-- Catalog fields
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS has_indoor         boolean,
  ADD COLUMN IF NOT EXISTS has_outdoor        boolean,

  -- Provenance: array of {type, url, fetched_at} objects
  -- Example: [{"type":"osm","url":"https://osm.org/way/123","fetched_at":"2026-09-09T00:00:00Z"}]
  ADD COLUMN IF NOT EXISTS sources            jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Browser agent enrichment queue
  ADD COLUMN IF NOT EXISTS needs_enrichment   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enriched_at        timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_attempts int NOT NULL DEFAULT 0;

-- Index for browser agent queue: quickly find venues waiting for enrichment
CREATE INDEX IF NOT EXISTS idx_venues_needs_enrichment
  ON venues (needs_enrichment)
  WHERE needs_enrichment = true;
