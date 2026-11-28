import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { readOwnPostImageUrls } from '@/lib/post-image'
import { exceedsPostBodyLimit, POST_BODY_LENGTH_ERROR } from '@/lib/post-limits'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { body?: string; image_url?: string; image_urls?: unknown }
  const text = body.body?.trim() ?? null
  if (text && exceedsPostBodyLimit(text)) {
    return NextResponse.json({ error: POST_BODY_LENGTH_ERROR }, { status: 400 })
  }
  const listed = readOwnPostImageUrls(body.image_urls ?? (body.image_url ? [body.image_url] : []), user.id)
  if (!Array.isArray(listed)) return NextResponse.json({ error: listed.error }, { status: 400 })

  if (!text && listed.length === 0) {
    return NextResponse.json({ error: 'Post must have text or image' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: user.id, type: 'manual', body: text, image_url: listed[0] ?? null })
    .select('id')
    .single()

  if (error) return apiError(500, 'Could not publish the post', error)

  if (listed.length > 0) {
    const { error: mediaError } = await supabase.from('post_media').insert(
      listed.map((url, index) => ({
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

  return NextResponse.json({ post_id: data.id })
}
