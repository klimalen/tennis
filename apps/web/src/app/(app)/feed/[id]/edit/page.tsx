'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clampPostBody, POST_BODY_MAX, POST_PHOTO_MAX } from '@/lib/post-limits'
import { compressRecapPhoto } from '@/lib/recap-image'
import { PostPhotoPicker } from '@/components/feed/PostPhotoPicker'
import { useHideTabBar } from '@/components/navigation/TabBarVisibility'

type DraftPhoto =
  | { id: string; kind: 'saved'; url: string }
  | { id: string; kind: 'new'; file: File; preview: string }

export default function EditPostPage() {
  useHideTabBar(true)
  const { id } = useParams<{ id: string }>()
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const photosRef = useRef<DraftPhoto[]>([])
  const router = useRouter()
  const supabase = useRef(createClient()).current

  photosRef.current = photos
  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        if (photo.kind === 'new') URL.revokeObjectURL(photo.preview)
      }
    }
  }, [])

  useEffect(() => {
    supabase
      .from('posts')
      .select('type, game_id, body, image_url, media:post_media(url, sort_order)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.type === 'game_recap' && data.game_id) {
          router.replace(`/games/${data.game_id}/recap`)
          return
        }
        if (data) {
          setText(clampPostBody(data.body ?? ''))
          const media = [...((data.media ?? []) as { url: string; sort_order: number }[])]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => ({ id: item.url, kind: 'saved' as const, url: item.url }))
          if (media.length > 0) setPhotos(media)
          else if (data.image_url) setPhotos([{ id: data.image_url, kind: 'saved', url: data.image_url }])
        }
        setLoading(false)
      })
  }, [id, router, supabase])

  function addPhotos(list: FileList | null) {
    if (!list || list.length === 0) return
    const incoming = [...list]
    const room = POST_PHOTO_MAX - photos.length
    if (room <= 0 || incoming.length > room) setError(`Up to ${POST_PHOTO_MAX} photos`)
    else setError('')
    const accepted = incoming.slice(0, Math.max(0, room))
    if (accepted.length === 0) return
    setPhotos((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        kind: 'new' as const,
        file,
        preview: URL.createObjectURL(file),
      })),
    ])
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === photoId)
      if (photo?.kind === 'new') URL.revokeObjectURL(photo.preview)
      return current.filter((item) => item.id !== photoId)
    })
  }

  async function handleSubmit() {
    if (submitting) return
    if (!text.trim() && photos.length === 0) return
    setSubmitting(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Sign in to save the post.')
      setSubmitting(false)
      return
    }

    let imageUrls: string[]
    try {
      imageUrls = await Promise.all(photos.map(async (photo) => {
        if (photo.kind === 'saved') return photo.url
        const blob = await compressRecapPhoto(photo.file)
        const path = `${user.id}/${crypto.randomUUID()}.jpg`
        const { error: uploadError } = await supabase.storage.from('post-images').upload(path, blob, { contentType: 'image/jpeg' })
        if (uploadError) throw new Error('upload')
        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path)
        return publicUrl
      }))
    } catch {
      setError('Could not upload a photo. Try again.')
      setSubmitting(false)
      return
    }

    const res = await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text.trim() || null, image_urls: imageUrls }),
    })
    if (!res.ok) {
      setError('Could not save the post. Try again.')
      setSubmitting(false)
      return
    }

    router.push('/feed')
    router.refresh()
  }

  const canPost = (text.trim().length > 0 || photos.length > 0) && !submitting

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-brand-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-8">
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </button>
          <span className="font-display text-2xl tracking-wide">EDIT POST</span>
          <button
            onClick={handleSubmit}
            disabled={!canPost}
            className="px-4 py-2 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(clampPostBody(e.target.value))}
            placeholder="What's on your mind?"
            rows={5}
            maxLength={POST_BODY_MAX}
            className="font-copy w-full bg-brand-field border border-[#1a1a1a]/40 rounded-lg resize-none text-[#1a1a1a] text-base placeholder:text-[rgba(26,26,26,0.4)] outline-none leading-relaxed px-4 py-3"
            autoFocus
          />
          <p className="mt-1 text-right text-[9px] text-[rgba(26,26,26,0.45)]">
            {text.length}/{POST_BODY_MAX}
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <PostPhotoPicker
          photos={photos.map((photo) => ({
            id: photo.id,
            src: photo.kind === 'saved' ? photo.url : photo.preview,
          }))}
          onAdd={addPhotos}
          onRemove={removePhoto}
        />
      </div>
    </div>
  )
}
