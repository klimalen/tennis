/**
 * Browser agent: enriches named tennis venues with phone, website, description,
 * court count, and indoor/outdoor info by browsing their official websites.
 *
 * Strategy:
 *   1. For each named venue needing enrichment, ask Claude to find its official site.
 *   2. Claude uses a `fetch_page` tool (we implement with Node fetch + HTML stripping).
 *      It first fetches a DuckDuckGo search, then navigates to the official site.
 *   3. Claude calls `save_enrichment` with structured output when done.
 *   4. We update Supabase and mark `needs_enrichment = false`.
 *
 * Usage:
 *   pnpm enrich:venues          # enrich all Austin venues that need it
 *   pnpm enrich:venues --dry-run  # show which venues would be processed
 *
 * Required env (auto-loaded from apps/web/.env.local):
 *   ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ─── Env ──────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', 'apps', 'web', '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) {
      const [, key, raw] = m
      if (key && raw !== undefined && !process.env[key])
        process.env[key] = raw.replace(/^["']|["']$/g, '')
    }
  }
}

loadEnvLocal()

function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env var: ${key}`)
  return v
}

// ─── Config ───────────────────────────────────────────────────────────────────

// Austin metro bbox — filter out venues from other cities in the DB
const AUSTIN_BBOX = { south: 30.05, west: -98.05, north: 30.60, east: -97.35 }

// Names that are clearly not real public venues
const SKIP_NAME_PATTERNS = [
  /residence/i,
  /not for public/i,
  /private/i,
  /hoa/i,         // HOA courts — no public website
]

const DRY_RUN = process.argv.includes('--dry-run')
const MAX_PAGES_PER_VENUE = 4    // max fetch_page calls per venue
const DELAY_BETWEEN_MS = 3_000  // pause between venues to be polite

// ─── HTML → text ──────────────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 6_000)
}

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; TennisApp/1.0; catalog-enrichment)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return `HTTP ${res.status} fetching ${url}`
    const html = await res.text()
    return htmlToText(html)
  } catch (e) {
    return `Error fetching ${url}: ${e instanceof Error ? e.message : String(e)}`
  }
}

// ─── Enrichment result type ───────────────────────────────────────────────────

interface EnrichmentResult {
  website: string | null
  phone: string | null
  description: string | null
  court_count: number | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  source_urls: string[]
}

// ─── Claude agent ─────────────────────────────────────────────────────────────

const fetchPageTool: Anthropic.Tool = {
  name: 'fetch_page',
  description:
    'Fetch the text content of a URL. Use this to read web pages including search result pages. Returns cleaned text (up to 6000 chars).',
  input_schema: {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: 'Full URL to fetch' },
    },
    required: ['url'],
  },
}

const saveEnrichmentTool: Anthropic.Tool = {
  name: 'save_enrichment',
  description:
    'Call this when you have gathered all available information. Provide only values you are confident about — leave fields null if not found. Do not guess.',
  input_schema: {
    type: 'object' as const,
    properties: {
      website: { type: 'string', description: 'Official website URL (must start with http)' },
      phone: { type: 'string', description: 'Phone number as found on the site' },
      description: {
        type: 'string',
        description: '1-2 sentence description of the venue (facilities, style, public/private)',
      },
      court_count: { type: 'number', description: 'Total number of tennis courts' },
      has_indoor: { type: 'boolean', description: 'Has indoor courts' },
      has_outdoor: { type: 'boolean', description: 'Has outdoor courts' },
      source_urls: {
        type: 'array',
        items: { type: 'string' },
        description: 'URLs where you found this information',
      },
    },
    required: ['source_urls'],
  },
}

async function runAgentForVenue(
  client: Anthropic,
  venue: { id: string; name: string; address: string | null; lat: number; lng: number },
): Promise<EnrichmentResult | null> {
  const location = venue.address ?? `Austin, TX (lat ${venue.lat.toFixed(4)}, lng ${venue.lng.toFixed(4)})`

  const systemPrompt = `You are enriching a tennis court/club catalog for Austin, TX.
Your job is to find the official website for a specific venue, verify it's correct, and extract contact information.
Be accurate. If you cannot find reliable information for a field, leave it null.
Never invent data. Only report what you actually find on the pages you visit.`

  const userMessage = `Find information for this tennis venue:

Name: "${venue.name}"
Location: ${location}
City: Austin, Texas, USA

Steps:
1. Fetch the DuckDuckGo search results for this venue to find its official website.
   Search URL: https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${venue.name}" Austin Texas tennis official site`)}
2. Identify the most likely official website from the search results.
3. Fetch the official website and extract the information.
4. Call save_enrichment with whatever you found (nulls for fields you couldn't confirm).

Important: Verify the website actually belongs to THIS venue (correct name and city).`

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ]

  let pagesVisited = 0
  let result: EnrichmentResult | null = null

  for (let turn = 0; turn < 10; turn++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools: [fetchPageTool, saveEnrichmentTool],
      messages,
    })

    // Add assistant turn to history
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') break
    if (response.stop_reason !== 'tool_use') break

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      if (block.name === 'fetch_page') {
        const input = block.input as { url: string }
        if (pagesVisited >= MAX_PAGES_PER_VENUE) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'Page limit reached. Please call save_enrichment now.',
          })
        } else {
          pagesVisited++
          process.stdout.write(`     fetch (${pagesVisited}): ${input.url.slice(0, 80)}…\n`)
          const text = await fetchPage(input.url)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: text,
          })
        }
      } else if (block.name === 'save_enrichment') {
        const input = block.input as EnrichmentResult
        result = {
          website: input.website ?? null,
          phone: input.phone ?? null,
          description: input.description ?? null,
          court_count: input.court_count ?? null,
          has_indoor: input.has_indoor ?? null,
          has_outdoor: input.has_outdoor ?? null,
          source_urls: input.source_urls ?? [],
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: 'Saved. Thank you.',
        })
      }
    }

    messages.push({ role: 'user', content: toolResults })

    // If we got the enrichment result, we're done
    if (result !== null) break
  }

  return result
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎾 Venue Enrichment Agent${DRY_RUN ? ' [DRY RUN]' : ''}\n`)

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const anthropic = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') })

  // Fetch Austin named venues that need enrichment
  const { data: venues, error } = await supabase
    .from('venues')
    .select('id, name, address, lat, lng, phone, website')
    .eq('needs_enrichment', true)
    .gte('lat', AUSTIN_BBOX.south)
    .lte('lat', AUSTIN_BBOX.north)
    .gte('lng', AUSTIN_BBOX.west)
    .lte('lng', AUSTIN_BBOX.east)
    .neq('name', 'Tennis Court')
    .neq('name', 'Tennis Courts')
    .order('name')

  if (error) throw new Error(`Supabase query failed: ${error.message}`)
  if (!venues || venues.length === 0) {
    console.log('No venues need enrichment.')
    return
  }

  // Filter out private/skip venues
  const targets = venues.filter(
    (v) => !SKIP_NAME_PATTERNS.some((re) => re.test(v.name)),
  )

  console.log(`Found ${targets.length} venues to enrich:\n`)
  targets.forEach((v, i) => console.log(`  ${i + 1}. ${v.name} (${v.address ?? 'no address'})`))

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Skipping agent. Run without --dry-run to enrich.')
    return
  }

  console.log()
  let enriched = 0
  let skipped = 0

  for (const venue of targets) {
    console.log(`\n[${enriched + skipped + 1}/${targets.length}] ${venue.name}`)

    try {
      const result = await runAgentForVenue(anthropic, venue)

      if (!result) {
        console.log('   → No result from agent')
        await supabase
          .from('venues')
          .update({ enrichment_attempts: supabase.rpc('coalesce', {}) })
          .eq('id', venue.id)
        skipped++
        continue
      }

      // Build the update object (only non-null fields)
      const update: Record<string, unknown> = {
        enriched_at: new Date().toISOString(),
        enrichment_attempts: 1,
        needs_enrichment: false,
      }

      if (result.website) update['website'] = result.website
      if (result.phone) update['phone'] = result.phone
      if (result.description) update['description'] = result.description
      // Claude may return the string "null" — coerce to actual null/number
      const courtCount = typeof result.court_count === 'number' ? result.court_count : null
      if (courtCount != null) update['court_count'] = courtCount
      if (result.has_indoor != null) update['has_indoor'] = result.has_indoor
      if (result.has_outdoor != null) update['has_outdoor'] = result.has_outdoor

      // Append browser_agent source to sources array
      if (result.source_urls.length > 0) {
        const { data: existing } = await supabase
          .from('venues')
          .select('sources')
          .eq('id', venue.id)
          .single()

        const existingSources: unknown[] = (existing?.sources as unknown[]) ?? []
        update['sources'] = [
          ...existingSources,
          {
            type: 'browser_agent',
            url: result.source_urls[0],
            fetched_at: new Date().toISOString(),
          },
        ]
      }

      const { error: updateError } = await supabase
        .from('venues')
        .update(update)
        .eq('id', venue.id)

      if (updateError) {
        console.error(`   ❌ DB update failed: ${updateError.message}`)
        skipped++
      } else {
        const found = [
          result.website && 'website',
          result.phone && 'phone',
          result.description && 'description',
          result.court_count != null && `${result.court_count} courts`,
        ]
          .filter(Boolean)
          .join(', ')
        console.log(`   ✅ Saved: ${found || 'no new data found'}`)
        enriched++
      }
    } catch (err) {
      console.error(`   ❌ Agent error: ${err instanceof Error ? err.message : err}`)
      skipped++
    }

    // Rate limit between venues
    if (enriched + skipped < targets.length) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS))
    }
  }

  console.log(`\n📊 Done: ${enriched} enriched, ${skipped} skipped / errors`)
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
