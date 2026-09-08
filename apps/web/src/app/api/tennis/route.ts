import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = 'https://api.api-tennis.com/tennis/'
const API_KEY = process.env.TENNIS_API_KEY ?? '99e7d617cae8bf00587a07f8decc9527024be51d516265872961c95a1b8e2074'

export async function GET(req: NextRequest) {

  const { searchParams } = new URL(req.url)
  const method = searchParams.get('method')
  if (!method) {
    return NextResponse.json({ error: 'method param required' }, { status: 400 })
  }

  const params = new URLSearchParams({ method, APIkey: API_KEY })
  for (const [key, value] of searchParams.entries()) {
    if (key !== 'method') params.set(key, value)
  }

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      next: { revalidate: 60 },
    })
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tennis data' }, { status: 502 })
  }
}
