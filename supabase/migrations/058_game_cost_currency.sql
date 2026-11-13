-- Games can price the court in USD or EUR. Amount stays in minor units
-- (cents / euro cents) on court_cost_cents; this column is the unit.
ALTER TABLE games
  ADD COLUMN cost_currency text
  CHECK (cost_currency IS NULL OR cost_currency IN ('USD', 'EUR'));

-- Existing priced games were always shown as dollars.
UPDATE games
SET cost_currency = 'USD'
WHERE court_cost_cents IS NOT NULL
  AND court_cost_cents > 0
  AND cost_currency IS NULL;

COMMENT ON COLUMN games.cost_currency IS
  'ISO code for court_cost_cents when priced (USD|EUR); null when free or unset.';
