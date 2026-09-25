import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { ownPostImageUrl } from '@/lib/post-image'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { body?: string; image_url?: string }
  const text = body.body?.trim() ?? null
  const imageUrl = body.image_url ? ownPostImageUrl(body.image_url, user.id) : null
  if (body.image_url && !imageUrl) {
    return NextResponse.json({ error: 'Photo must be uploaded to your account' }, { status: 400 })
  }

  if (!text && !imageUrl) {
    return NextResponse.json({ error: 'Post must have text or image' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: user.id, type: 'manual', body: text, image_url: imageUrl })
    .select('id')
    .single()

  if (error) return apiError(500, 'Could not publish the post', error)

  return NextResponse.json({ post_id: data.id })
}
