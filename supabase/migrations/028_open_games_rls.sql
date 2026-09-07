-- Allow anyone authenticated to see participants of public (open) games.
-- Without this, browsing users see 0 participants → wrong spot count.
-- Uses SECURITY DEFINER to avoid recursive RLS chain:
--   game_participants SELECT → games SELECT → game_participants SELECT → ...

CREATE OR REPLACE FUNCTION open_game_ids()
  RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT id FROM games WHERE is_open = true AND scheduled_at > now();
$$;

CREATE POLICY "Anyone can see participants of open games"
  ON game_participants FOR SELECT
  USING (game_id IN (SELECT open_game_ids()));
