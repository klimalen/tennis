import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? '*' }))

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

const port = Number(process.env['BACKEND_PORT'] ?? 3001)
console.log(`Backend running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
