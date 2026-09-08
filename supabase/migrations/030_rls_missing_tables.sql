-- Enable RLS on tables that were missing it.
-- Note: spatial_ref_sys is a PostGIS system table owned by the extension,
-- it cannot be altered — the Supabase warning for it can be ignored.

-- cities: public read-only (used for city autocomplete by all users)
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cities"
  ON public.cities FOR SELECT
  USING (true);

-- player_skill_history: only the player themselves can read their own history
ALTER TABLE public.player_skill_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read own skill history"
  ON public.player_skill_history FOR SELECT
  USING (auth.uid() = player_id);
