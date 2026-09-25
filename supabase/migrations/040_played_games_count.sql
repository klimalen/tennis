-- Public Games counter. Private games stay hidden by RLS, but the count of
-- games a player actually finished is visible on their profile.
CREATE OR REPLACE FUNCTION played_games_count(p_player_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT count(DISTINCT g.id)::integer
  FROM games g
  WHERE g.status NOT IN ('cancelled', 'draft')
    AND g.scheduled_at + (g.duration_minutes * interval '1 minute') <= now()
    AND (
      g.creator_id = p_player_id
      OR EXISTS (
        SELECT 1
        FROM game_participants gp
        WHERE gp.game_id = g.id
          AND gp.player_id = p_player_id
          AND gp.status = 'accepted'
      )
    );
$$;

REVOKE ALL ON FUNCTION played_games_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION played_games_count(uuid) TO anon, authenticated;
