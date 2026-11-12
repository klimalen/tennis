/**
 * Austin entry point. Same implementation as `pnpm venues ingest --city austin`.
 *
 *   pnpm ingest:austin
 *   pnpm ingest:austin --dry-run
 *   pnpm ingest:austin --no-cache
 */

import { ingestCourts } from './lib/ingest-courts'
import { loadEnvLocal, CITIES } from './lib/venue-common'

loadEnvLocal()

const city = CITIES['austin']
if (!city) throw new Error('Austin city config missing')

ingestCourts({
  city,
  dryRun: process.argv.includes('--dry-run'),
  noCache: process.argv.includes('--no-cache'),
}).catch((err: unknown) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
