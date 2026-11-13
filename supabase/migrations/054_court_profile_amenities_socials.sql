-- Optional court facility facts + social handles (onboarding / edit).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS court_count integer
    CHECK (court_count IS NULL OR court_count > 0),
  ADD COLUMN IF NOT EXISTS lit boolean,
  ADD COLUMN IF NOT EXISTS fee_hour_min numeric
    CHECK (fee_hour_min IS NULL OR fee_hour_min >= 0),
  ADD COLUMN IF NOT EXISTS fee_hour_max numeric
    CHECK (fee_hour_max IS NULL OR fee_hour_max >= 0),
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS telegram text,
  ADD COLUMN IF NOT EXISTS facebook text;

COMMENT ON COLUMN profiles.court_count IS 'Number of courts at this facility (court accounts).';
COMMENT ON COLUMN profiles.lit IS 'Whether courts have lighting (court accounts).';
COMMENT ON COLUMN profiles.fee_hour_min IS 'Approximate hourly fee lower bound (court accounts; currency local/unspecified).';
COMMENT ON COLUMN profiles.fee_hour_max IS 'Approximate hourly fee upper bound (court accounts; currency local/unspecified).';
COMMENT ON COLUMN profiles.whatsapp IS 'WhatsApp number or wa.me handle for court accounts.';
COMMENT ON COLUMN profiles.instagram IS 'Instagram handle (without @) for court accounts.';
COMMENT ON COLUMN profiles.telegram IS 'Telegram username/handle for court accounts.';
COMMENT ON COLUMN profiles.facebook IS 'Facebook page URL or handle for court accounts.';
