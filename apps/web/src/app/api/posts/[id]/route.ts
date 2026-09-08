import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { body?: string | null; image_url?: string | null }

  const { error } = await supabase
    .from('posts')
    .update({ body: body.body ?? null, image_url: body.image_url ?? null })
    .eq('id', id)
    .eq('author_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  // Also delete image from storage if present
  const { data: post } = await supabase
    .from('posts')
    .select('image_url')
    .eq('id', id)
    .eq('author_id', user.id)
    .single()

  if (post?.image_url) {
    // Extract path from public URL: .../post-images/{userId}/{filename}
    const url = new URL(post.image_url)
    const pathParts = url.pathname.split('/post-images/')
    if (pathParts[1]) {
      await supabase.storage.from('post-images').remove([pathParts[1]])
    }
  }

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
