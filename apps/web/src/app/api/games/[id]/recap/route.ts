import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { gameEndMs } from '@/lib/game-time'
import { parseRecapVisibility, RECAP_PHOTO_MAX, type RecapVisibility } from '@/lib/game-recap'
import { ownPostImageUrl, postImageStoragePath } from '@/lib/post-image'
import { exceedsPostBodyLimit, POST_BODY_LENGTH_ERROR } from '@/lib/post-limits'
import { holdsGameSeat } from '@/lib/schedule'
import { NextResponse } from 'next/server'

type RecapBody = {
  body?: string | null
  visibility?: string | null
  image_urls?: unknown
}

async function removeStored(supabase: Awaited<ReturnType<typeof createClient>>, urls: string[]) {
  const paths = urls.flatMap((url) => {
    const path = postImageStoragePath(url)
    return path ? [path] : []
  })
  if (paths.length === 0) return
  await supabase.storage.from('post-images').remove(paths)
}

function readPayload(raw: RecapBody, userId: string): {
  text: string | null
  visibility: RecapVisibility
  imageUrls: string[]
} | { error: string } {
  const text = raw.body?.trim() ? raw.body.trim() : null
  if (text && exceedsPostBodyLimit(text)) return { error: POST_BODY_LENGTH_ERROR }
  const visibility = parseRecapVisibility(raw.visibility)
  if (!visibility) return { error: 'Choose who can see this recap' }
  const incoming = raw.image_urls ?? []
  if (!Array.isArray(incoming)) return { error: 'Photo must be uploaded to your account' }
  if (incoming.length > RECAP_PHOTO_MAX) return { error: `Up to ${RECAP_PHOTO_MAX} photos` }
  const imageUrls: string[] = []
  for (const entry of incoming) {
    if (typeof entry !== 'string') return { error: 'Photo must be uploaded to your account' }
    const url = ownPostImageUrl(entry, userId)
    if (!url) return { error: 'Photo must be uploaded to your account' }
    imageUrls.push(url)
  }
  if (!text && imageUrls.length === 0) return { error: 'Add a note or a photo' }
  return { text, visibility, imageUrls }
}

async function loadPlayableGame(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameId: string,
  userId: string,
) {
  const { data: game } = await supabase
    .from('games')
    .select('id, status, scheduled_at, duration_minutes, creator_id')
    .eq('id', gameId)
    .maybeSingle()
  if (!game || game.status === 'draft') return { error: 'Game not found', status: 404 as const }
  const inGame = game.creator_id === userId || await (async () => {
    const { data: seat } = await supabase
      .from('game_participants')
      .select('status')
      .eq('game_id', gameId)
      .eq('player_id', userId)
      .maybeSingle()
    return Boolean(seat && holdsGameSeat(seat.status))
  })()
  if (!inGame) return { error: 'Only people in the game can write a recap', status: 403 as const }
  return { game }
}

async function ownRecap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('posts')
    .select('id, body, visibility, media:post_media (url, sort_order)')
    .eq('game_id', gameId)
    .eq('author_id', userId)
    .eq('type', 'game_recap')
    .maybeSingle()
  if (!data) return null
  const media = [...((data.media ?? []) as { url: string; sort_order: number }[])]
    .sort((a, b) => a.sort_order - b.sort_order)
  return {
    id: data.id as string,
    body: (data.body as string | null) ?? null,
    visibility: data.visibility as RecapVisibility,
    image_urls: media.map((item) => item.url),
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const recap = await ownRecap(supabase, id, user.id)
  return NextResponse.json({ recap })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const loaded = await loadPlayableGame(supabase, id, user.id)
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status ?? 400 })
  }
  const { game } = loaded
  if (game.status === 'cancelled') {
    return NextResponse.json({ error: "Cancelled games can't have a recap" }, { status: 403 })
  }
  if (gameEndMs(game.scheduled_at, game.duration_minutes) > Date.now()) {
    return NextResponse.json({ error: 'You can add a recap after the game ends' }, { status: 403 })
  }

  const payload = readPayload(await request.json() as RecapBody, user.id)
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 })

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: user.id,
      type: 'game_recap',
      game_id: id,
      body: payload.text,
      visibility: payload.visibility,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You already have a recap for this game' }, { status: 409 })
    }
    return apiError(500, 'Could not publish the recap', error)
  }

  if (payload.imageUrls.length > 0) {
    const { error: mediaError } = await supabase.from('post_media').insert(
      payload.imageUrls.map((url, index) => ({
        post_id: data.id,
        author_id: user.id,
        url,
        sort_order: index,
      })),
    )
    if (mediaError) {
      await supabase.from('posts').delete().eq('id', data.id).eq('author_id', user.id)
      return apiError(500, 'Could not save the photos', mediaError)
    }
  }

  return NextResponse.json({ id: data.id })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const current = await ownRecap(supabase, id, user.id)
  if (!current) return NextResponse.json({ error: 'Recap not found' }, { status: 404 })

  const payload = readPayload(await request.json() as RecapBody, user.id)
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 })

  const { error } = await supabase
    .from('posts')
    .update({ body: payload.text, visibility: payload.visibility })
    .eq('id', current.id)
    .eq('author_id', user.id)
    .eq('type', 'game_recap')
  if (error) return apiError(500, 'Could not save the recap', error)

  const { data: previous } = await supabase
    .from('post_media')
    .select('id, url')
    .eq('post_id', current.id)
  const previousRows = (previous ?? []) as { id: string; url: string }[]

  if (previousRows.length > 0) {
    const { error: clearError } = await supabase.from('post_media').delete().eq('post_id', current.id)
    if (clearError) return apiError(500, 'Could not save the photos', clearError)
  }

  if (payload.imageUrls.length > 0) {
    const { error: mediaError } = await supabase.from('post_media').insert(
      payload.imageUrls.map((url, index) => ({
        post_id: current.id,
        author_id: user.id,
        url,
        sort_order: index,
      })),
    )
    if (mediaError) {
      if (previousRows.length > 0) {
        await supabase.from('post_media').insert(
          previousRows.map((row, index) => ({
            post_id: current.id,
            author_id: user.id,
            url: row.url,
            sort_order: index,
          })),
        )
      }
      return apiError(500, 'Could not save the photos', mediaError)
    }
  }

  const keep = new Set(payload.imageUrls)
  await removeStored(supabase, previousRows.map((row) => row.url).filter((url) => !keep.has(url)))
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const current = await ownRecap(supabase, id, user.id)
  if (!current) return NextResponse.json({ error: 'Recap not found' }, { status: 404 })

  const { error } = await supabase.from('posts').delete().eq('id', current.id).eq('author_id', user.id)
  if (error) return apiError(500, 'Could not delete the recap', error)
  await removeStored(supabase, current.image_urls)
  return NextResponse.json({ ok: true })
}
