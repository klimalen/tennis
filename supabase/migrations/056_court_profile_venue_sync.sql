-- When a court profile is linked to a venue_groups card, non-empty profile
-- fields overwrite the catalog row. Empty profile fields leave catalog values.
-- Lat/lng / kind / OSM provenance stay on the card.

ALTER TABLE venue_groups
  ADD COLUMN IF NOT EXISTS fee_hour_min numeric
    CHECK (fee_hour_min IS NULL OR fee_hour_min >= 0),
  ADD COLUMN IF NOT EXISTS fee_hour_max numeric
    CHECK (fee_hour_max IS NULL OR fee_hour_max >= 0);

COMMENT ON COLUMN venue_groups.fee_hour_min IS 'Synced from linked court profile when set.';
COMMENT ON COLUMN venue_groups.fee_hour_max IS 'Synced from linked court profile when set.';

CREATE OR REPLACE FUNCTION sync_venue_group_from_court_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_surface text;
BEGIN
  IF NEW.account_kind IS DISTINCT FROM 'court' THEN
    RETURN NEW;
  END IF;

  IF NEW.preferred_surfaces IS NOT NULL AND array_length(NEW.preferred_surfaces, 1) >= 1 THEN
    next_surface := NEW.preferred_surfaces[1]::text;
  ELSE
    next_surface := NULL;
  END IF;

  UPDATE venue_groups SET
    name = CASE
      WHEN NULLIF(btrim(NEW.full_name), '') IS NOT NULL THEN btrim(NEW.full_name)
      ELSE name
    END,
    address = CASE
      WHEN NULLIF(btrim(NEW.address), '') IS NOT NULL THEN btrim(NEW.address)
      ELSE address
    END,
    phone = CASE
      WHEN NULLIF(btrim(NEW.phone), '') IS NOT NULL THEN btrim(NEW.phone)
      ELSE phone
    END,
    website = CASE
      WHEN NULLIF(btrim(NEW.website), '') IS NOT NULL THEN btrim(NEW.website)
      ELSE website
    END,
    opening_hours = CASE
      WHEN NULLIF(btrim(NEW.opening_hours), '') IS NOT NULL THEN btrim(NEW.opening_hours)
      ELSE opening_hours
    END,
    description = CASE
      WHEN NULLIF(btrim(NEW.bio), '') IS NOT NULL THEN btrim(NEW.bio)
      ELSE description
    END,
    court_count = CASE
      WHEN NEW.court_count IS NOT NULL THEN NEW.court_count
      ELSE court_count
    END,
    surface = CASE
      WHEN next_surface IS NOT NULL THEN next_surface
      ELSE surface
    END,
    has_indoor = CASE
      WHEN NEW.has_indoor IS NOT NULL THEN NEW.has_indoor
      ELSE has_indoor
    END,
    has_outdoor = CASE
      WHEN NEW.has_outdoor IS NOT NULL THEN NEW.has_outdoor
      ELSE has_outdoor
    END,
    lit = CASE
      WHEN NEW.lit IS NOT NULL THEN NEW.lit
      ELSE lit
    END,
    fee_hour_min = CASE
      WHEN NEW.fee_hour_min IS NOT NULL THEN NEW.fee_hour_min
      ELSE fee_hour_min
    END,
    fee_hour_max = CASE
      WHEN NEW.fee_hour_max IS NOT NULL THEN NEW.fee_hour_max
      ELSE fee_hour_max
    END,
    fee = CASE
      WHEN NEW.fee_hour_min IS NOT NULL OR NEW.fee_hour_max IS NOT NULL THEN true
      ELSE fee
    END,
    updated_at = now()
  WHERE profile_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_venue_group ON profiles;
CREATE TRIGGER profiles_sync_venue_group
  AFTER INSERT OR UPDATE OF
    full_name, address, phone, website, opening_hours, bio,
    court_count, preferred_surfaces, has_indoor, has_outdoor, lit,
    fee_hour_min, fee_hour_max, account_kind
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_venue_group_from_court_profile();

-- When a catalog card is newly linked to a court profile, pull profile fields once.
CREATE OR REPLACE FUNCTION sync_venue_group_on_profile_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p profiles%ROWTYPE;
  next_surface text;
BEGIN
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.profile_id IS NOT DISTINCT FROM NEW.profile_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO p FROM profiles WHERE id = NEW.profile_id AND account_kind = 'court';
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF p.preferred_surfaces IS NOT NULL AND array_length(p.preferred_surfaces, 1) >= 1 THEN
    next_surface := p.preferred_surfaces[1]::text;
  ELSE
    next_surface := NULL;
  END IF;

  NEW.name := CASE WHEN NULLIF(btrim(p.full_name), '') IS NOT NULL THEN btrim(p.full_name) ELSE NEW.name END;
  NEW.address := CASE WHEN NULLIF(btrim(p.address), '') IS NOT NULL THEN btrim(p.address) ELSE NEW.address END;
  NEW.phone := CASE WHEN NULLIF(btrim(p.phone), '') IS NOT NULL THEN btrim(p.phone) ELSE NEW.phone END;
  NEW.website := CASE WHEN NULLIF(btrim(p.website), '') IS NOT NULL THEN btrim(p.website) ELSE NEW.website END;
  NEW.opening_hours := CASE WHEN NULLIF(btrim(p.opening_hours), '') IS NOT NULL THEN btrim(p.opening_hours) ELSE NEW.opening_hours END;
  NEW.description := CASE WHEN NULLIF(btrim(p.bio), '') IS NOT NULL THEN btrim(p.bio) ELSE NEW.description END;
  NEW.court_count := CASE WHEN p.court_count IS NOT NULL THEN p.court_count ELSE NEW.court_count END;
  NEW.surface := CASE WHEN next_surface IS NOT NULL THEN next_surface ELSE NEW.surface END;
  NEW.has_indoor := CASE WHEN p.has_indoor IS NOT NULL THEN p.has_indoor ELSE NEW.has_indoor END;
  NEW.has_outdoor := CASE WHEN p.has_outdoor IS NOT NULL THEN p.has_outdoor ELSE NEW.has_outdoor END;
  NEW.lit := CASE WHEN p.lit IS NOT NULL THEN p.lit ELSE NEW.lit END;
  NEW.fee_hour_min := CASE WHEN p.fee_hour_min IS NOT NULL THEN p.fee_hour_min ELSE NEW.fee_hour_min END;
  NEW.fee_hour_max := CASE WHEN p.fee_hour_max IS NOT NULL THEN p.fee_hour_max ELSE NEW.fee_hour_max END;
  NEW.fee := CASE
    WHEN p.fee_hour_min IS NOT NULL OR p.fee_hour_max IS NOT NULL THEN true
    ELSE NEW.fee
  END;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venue_groups_sync_on_profile_link ON venue_groups;
CREATE TRIGGER venue_groups_sync_on_profile_link
  BEFORE INSERT OR UPDATE OF profile_id
  ON venue_groups
  FOR EACH ROW
  EXECUTE FUNCTION sync_venue_group_on_profile_link();

-- Court owners may refresh their linked catalog row from the client if needed.
CREATE POLICY "Courts update own linked venue group"
  ON venue_groups FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
