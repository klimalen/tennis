import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { ownPostImageUrl, postImageStoragePath } from '@/lib/post-image'
import { exceedsPostBodyLimit, POST_BODY_LENGTH_ERROR } from '@/lib/post-limits'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: current } = await supabase
    .from('posts')
    .select('type')
    .eq('id', id)
    .eq('author_id', user.id)
    .maybeSingle()
  if (!current) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (current.type === 'game_recap') {
    return NextResponse.json({ error: 'Edit this recap from the game' }, { status: 400 })
  }

  const body = await request.json() as { body?: string | null; image_url?: string | null }
  const text = body.body?.trim() ? body.body.trim() : null
  if (text && exceedsPostBodyLimit(text)) {
    return NextResponse.json({ error: POST_BODY_LENGTH_ERROR }, { status: 400 })
  }
  const imageUrl = body.image_url ? ownPostImageUrl(body.image_url, user.id) : null
  if (body.image_url && !imageUrl) {
    return NextResponse.json({ error: 'Photo must be uploaded to your account' }, { status: 400 })
  }

  const { error } = await supabase
    .from('posts')
    .update({ body: text, image_url: imageUrl })
    .eq('id', id)
    .eq('author_id', user.id)

  if (error) return apiError(500, 'Could not save the post', error)
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

  const { data: post } = await supabase
    .from('posts')
    .select('image_url, media:post_media (url)')
    .eq('id', id)
    .eq('author_id', user.id)
    .maybeSingle()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id)
  if (error) return apiError(500, 'Could not delete the post', error)

  const media = (post.media ?? []) as { url: string }[]
  const paths = [post.image_url, ...media.map((item) => item.url)].flatMap((url) => {
    const path = postImageStoragePath(url)
    return path ? [path] : []
  })
  if (paths.length > 0) await supabase.storage.from('post-images').remove(paths)
  return NextResponse.json({ ok: true })
}
