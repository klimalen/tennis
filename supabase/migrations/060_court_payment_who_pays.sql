-- Court cost is settled outside the app; the only useful signal is who covers it.
-- "at_court" was about place of payment and overlapped Split / Host pays.

UPDATE games
SET payment = 'split'
WHERE payment = 'at_court';

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_payment_check;
ALTER TABLE games
  ADD CONSTRAINT games_payment_check
  CHECK (payment IS NULL OR payment IN ('split', 'host'));

COMMENT ON COLUMN games.payment IS
  'Who covers court_cost_cents: split between players, or host. Null when free/unset.';
