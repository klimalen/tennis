-- Per-day parts of the day. Keys are weekday numbers (0 = Sunday),
-- values are any of morning, afternoon, evening.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS availability jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Carry the old single window onto each selected day. Night folds into evening.
UPDATE profiles AS p
SET availability = sub.availability
FROM (
  SELECT
    id,
    jsonb_object_agg(
      day::text,
      jsonb_build_array(
        CASE
          WHEN preferred_time_start < time '12:00' THEN 'morning'
          WHEN preferred_time_start < time '17:00' THEN 'afternoon'
          ELSE 'evening'
        END
      )
    ) AS availability
  FROM profiles, unnest(preferred_days) AS day
  WHERE cardinality(preferred_days) > 0
    AND preferred_time_start IS NOT NULL
  GROUP BY id
) AS sub
WHERE p.id = sub.id
  AND p.availability = '{}'::jsonb;
