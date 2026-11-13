-- Court profile: street address + opening hours (shown on /me, public profile, and merged into catalog when linked).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS opening_hours text;

COMMENT ON COLUMN profiles.address IS 'Street / place address for court accounts (city stays in city_name).';
COMMENT ON COLUMN profiles.opening_hours IS 'Free-text opening hours for court accounts (e.g. Mo-Su 06:00-24:00).';
