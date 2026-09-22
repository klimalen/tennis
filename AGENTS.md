# AGENTS.md

Orientation for anyone (human or agent) starting work in this repository. Read this first, then the
docs linked below as needed.

## What this is

**Tennis** — a "social operating system for racket sports": find players and courts, create and join
open games, chat, follow players, post to a feed, track the pro tour. Web first; mobile is a
placeholder. Multisport by design (`sport` column everywhere), but everything is `tennis` today.

Launch city is **Austin, TX** — several scripts and datasets are Austin-specific on purpose.

Product & design docs (written in Russian):

| Doc | What's in it |
|---|---|
| `docs/roadmap.md` | Product vision, phases (MVP → Courts & Open Games → Coaches → Social → Competitions → B2B), tech stack |
| `docs/data-model.md` | Full DB design: principles, enums, every table with columns and relations |
| `docs/launch-city-research.md` | Why Austin |
| `ref/brand-book.md` (+ `ref/brand-*.html`) | Visual identity: palette, typography, illustration style, layout rules — follow it for any UI work |

## Repository layout

```
apps/web/        Next.js 15 (App Router, React 19, Tailwind, lucide-react) — the product. Most logic lives here.
apps/backend/    Hono on Node — currently only GET /health. Not used by the web app yet.
apps/mobile/     Expo / React Native placeholder.
packages/shared/ @tennis/shared — TypeScript enums + entity interfaces shared across apps.
scripts/         Data tooling (tsx): Austin court ingestion and the venue catalog pipeline. Own tsconfig.
supabase/        migrations/ (numbered SQL, applied in order) + config.toml.
docs/, ref/      Product docs and brand assets (see above).
```

pnpm workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/*`).

## Commands

```bash
pnpm install

pnpm dev                          # web (:3000) + backend (:3001) in parallel
pnpm --filter web dev             # web only
pnpm --filter web typecheck       # tsc for the web app
pnpm --filter web build           # next build — run before finishing web changes
pnpm --filter web lint
pnpm typecheck:scripts            # tsc for scripts/ (separate tsconfig)
pnpm --filter backend dev         # Hono on :3001

pnpm ingest:austin [--dry-run]    # raw court polygons for Austin → venues (OSM Overpass + Geoapify + Austin Open Data)
pnpm venues <cmd> [--city austin] # venue catalog pipeline, see below
```

There is no test suite. Verification = typecheck + `next build` + manual check in the browser.

## Environment

Copy `.env.example` → `apps/web/.env.local`. Scripts auto-load `apps/web/.env.local` too.

| Var | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web (browser + SSR), scripts | required |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts only | bypasses RLS — never import into browser code |
| `GOOGLE_PLACES_API_KEY` | `pnpm venues identify` | optional; ~1 request per organization, within free tier |
| `ANTHROPIC_API_KEY` | `pnpm venues agent` | optional |
| `GEOAPIFY_API_KEY` | `pnpm ingest:austin` | optional |
| `TENNIS_API_KEY` | `/api/tennis` (api-tennis.com pro-tour data) | has a hardcoded fallback in the route — known debt |

Supabase CLI work (linking, `db push`) additionally needs `SUPABASE_ACCESS_TOKEN` and the DB password.

## Architecture in one screen

- **Auth**: Supabase Auth via `@supabase/ssr`. `apps/web/src/lib/supabase/{client,server}.ts` create the
  browser/server clients. `apps/web/src/middleware.ts` refreshes the session on every request and redirects
  anonymous users away from `/me/edit`, `/create`, `/schedule/book`, `/settings`, `/chats`, `/games`. It
  deliberately skips `/auth/*` (PKCE cookies). `/auth/callback` exchanges the code and sends users without
  `profiles.skill_level_self` to `/onboarding`.
- **Where logic lives**: Next.js Route Handlers under `apps/web/src/app/api/*` plus Postgres (RLS policies,
  triggers, RPC functions in migrations). The Hono backend is a stub — don't add features there unless the
  task says so.
- **Data access**: components and route handlers call Supabase directly with the user's session; RLS is
  the authorization layer. Anything that must bypass RLS (catalog scripts) uses the service role key from
  `scripts/`.
- **Realtime**: chats, unread counters, game participants/requests, games use Supabase Realtime
  (publications are set up in migrations 018–027).
- **Geo**: PostGIS `geography(Point, 4326)` columns, `ST_Distance` for radius search. `cities` carries
  coordinates for map defaults.
- **Roles**: single `profiles` table; player/coach/etc. are flags, not separate tables.
- **Shared types**: `@tennis/shared` (`packages/shared/src/types/*`). Note: it lags the actual schema in
  places — treat migrations as the source of truth and update shared types when you touch an entity.

Route map (web): `/` landing · `(auth)/sign-in|sign-up|forgot-password|reset-password|verify-email` ·
`/onboarding` · `(app)/search` (players, open games, **courts**) · `games/*` · `chats/*` · `feed/*` ·
`schedule` · `me/*`, `profile/[username]` · `settings`. API: `api/players|games|open-games|game-requests|
conversations|messages|connections|follows|posts|nav-badges|venues|tennis`.

## Database & migrations

- `supabase/migrations/NNN_name.sql`, applied in numeric order. **Never edit an applied migration** — add a
  new numbered file. Latest is `037_venue_groups.sql`.
- Every table has RLS enabled; add policies in the same migration that creates a table.
- Conventions (from `docs/data-model.md`): uuid PKs, `created_at`/`updated_at` with the
  `update_updated_at()` trigger, soft delete where relevant, denormalized counters, `metadata jsonb` for
  extensibility.
- Applying to the hosted project: `supabase link` + `supabase db push`, or run the SQL via the Supabase
  Management API / SQL editor and record the version in `supabase_migrations.schema_migrations` so the
  CLI stays in sync.

## Venue catalog (courts in Austin)

Two tables:

- `venues` — one row per raw OSM court polygon (from `pnpm ingest:austin`). Low-value on its own: almost
  no names, no contacts.
- `venue_groups` — one row per **organization** (park, tennis center, club, school, HOA…): name, kind,
  centroid, address, phone, website, hours, description, court count, surface, indoor/outdoor, access,
  fee, provenance (`sources`), `confidence`, enrichment flags. `venues.group_id` attaches courts to it.
  This is what the UI shows as a court card.

Pipeline (`scripts/venue-pipeline.ts`, libs in `scripts/lib/`):

```
pnpm venues cluster    # courts in the same OSM parent polygon or within 120 m → one group (idempotent, merges same-name halves)
pnpm venues identify   # name/kind from enclosing OSM feature → Google Places (optional) → Nominatim address
pnpm venues queue      # JSON work-queue of groups still missing data (private/residential excluded by default)
pnpm venues apply <f>  # validate + normalize + write results back (--overwrite to replace existing values)
pnpm venues agent      # Claude with web_search + fetch_page fills the queue automatically (needs ANTHROPIC_API_KEY)
pnpm venues stats      # coverage report
pnpm venues all        # cluster + identify + queue
```

Rules that matter:

- Identification is **geography-first** (parent polygon, then nearest place at the centroid). Searching the
  web by the OSM name is useless — almost none exist.
- `residential` (HOA/apartment) groups are named but never sent to paid layers and are hidden from
  `/api/venues` unless `?include_private=1`.
- `/api/venues` serves `venue_groups`; for cities without a catalog it falls back to runtime clustering of
  ungrouped `venues`.
- Overpass is flaky (504s); `scripts/lib/osm-parents.ts` retries across mirrors and caches in
  `scripts/.cache/` (gitignored). Use `--no-cache` to refetch.
- Agent output is normalized in `sanitizeResult` (phones, URLs, surface enum, hours, text clamps) — extend
  it rather than writing raw agent output to the DB.

## Conventions & gotchas

- TypeScript strict everywhere (`tsconfig.base.json`); `process.env['X']` bracket access is the style.
- Docs are in Russian; code, comments, commit messages in English. Conventional-commit style prefixes
  (`feat(courts): …`, `fix(tour): …`, `chore: …`).
- Keep UI on-brand: see `ref/brand-book.md` before adding components. Shared primitives live in
  `apps/web/src/components/ui`.
- `scripts/` run with `tsx`; a standalone file using top-level `await` needs the `.mts` extension.
- Don't commit `*.tsbuildinfo`, `scripts/.cache/`, or `.env*` (all gitignored).
- `middleware.ts` matcher runs on every non-static path — keep it cheap.
