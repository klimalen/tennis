-- Add city coordinates to profiles for distance-based player discovery
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS city_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS city_lng  DOUBLE PRECISION;
