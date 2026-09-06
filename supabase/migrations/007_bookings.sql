CREATE TABLE court_bookings (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  court_id                 uuid NOT NULL REFERENCES courts(id),
  court_slot_id            uuid REFERENCES court_slots(id),
  booked_by                uuid NOT NULL REFERENCES profiles(id),
  game_id                  uuid REFERENCES games(id),
  starts_at                timestamptz NOT NULL,
  ends_at                  timestamptz NOT NULL,
  total_amount             numeric NOT NULL CHECK (total_amount >= 0),
  currency                 text NOT NULL DEFAULT 'USD',
  status                   booking_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_court_bookings_court ON court_bookings (court_id, starts_at);
CREATE INDEX idx_court_bookings_user  ON court_bookings (booked_by);
CREATE INDEX idx_court_bookings_game  ON court_bookings (game_id);

CREATE TRIGGER court_bookings_updated_at
  BEFORE UPDATE ON court_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE games ADD CONSTRAINT games_court_booking_fk
  FOREIGN KEY (court_booking_id) REFERENCES court_bookings(id);

CREATE TABLE booking_splits (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id               uuid NOT NULL REFERENCES court_bookings(id) ON DELETE CASCADE,
  player_id                uuid NOT NULL REFERENCES profiles(id),
  amount                   numeric NOT NULL CHECK (amount >= 0),
  status                   payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id text,
  UNIQUE (booking_id, player_id)
);

ALTER TABLE court_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bookings" ON court_bookings FOR SELECT USING (auth.uid() = booked_by);
CREATE POLICY "Users view own splits"   ON booking_splits FOR SELECT USING (auth.uid() = player_id);
