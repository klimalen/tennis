-- Indoor/outdoor is environment, not surface_type. Store separately on court profiles
-- (matches venue_groups.has_indoor / has_outdoor). preferred_surfaces stays surface_type[].
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_indoor boolean,
  ADD COLUMN IF NOT EXISTS has_outdoor boolean;

COMMENT ON COLUMN profiles.has_indoor IS 'Whether the facility has indoor courts (court accounts).';
COMMENT ON COLUMN profiles.has_outdoor IS 'Whether the facility has outdoor courts (court accounts).';
