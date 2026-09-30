-- Last app open drives the player list. Players cannot set the column themselves;
-- opening the app calls touch_last_active(), which is the only allowed write.

CREATE OR REPLACE FUNCTION profiles_keep_system_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.role() IS NULL
     AND current_user IS DISTINCT FROM 'authenticated'
     AND current_user IS DISTINCT FROM 'anon' THEN
    RETURN NEW;
  END IF;

  NEW.skill_level_computed := OLD.skill_level_computed;
  NEW.skill_level_verified_by := OLD.skill_level_verified_by;
  NEW.is_club_manager := OLD.is_club_manager;
  NEW.reliability_score := OLD.reliability_score;
  NEW.total_matches := OLD.total_matches;
  NEW.identity_verified := OLD.identity_verified;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.birth_year := OLD.birth_year;
  NEW.gender := OLD.gender;
  NEW.location := OLD.location;
  NEW.deleted_at := OLD.deleted_at;
  NEW.created_at := OLD.created_at;
  IF current_setting('app.allow_last_active', true) IS DISTINCT FROM '1' THEN
    NEW.last_active_at := OLD.last_active_at;
  END IF;
  NEW.id := OLD.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION touch_last_active()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('app.allow_last_active', '1', true);

  UPDATE profiles
  SET last_active_at = now()
  WHERE id = auth.uid()
    AND (last_active_at IS NULL OR last_active_at < now() - interval '15 minutes');
END;
$$;

REVOKE ALL ON FUNCTION touch_last_active() FROM public;
GRANT EXECUTE ON FUNCTION touch_last_active() TO authenticated;

-- Existing accounts have never stored a visit. Start from the last sign-in
-- so the list is ordered before each person opens the app again.
UPDATE profiles AS p
SET last_active_at = u.last_sign_in_at
FROM auth.users AS u
WHERE p.id = u.id
  AND p.last_active_at IS NULL
  AND u.last_sign_in_at IS NOT NULL;
