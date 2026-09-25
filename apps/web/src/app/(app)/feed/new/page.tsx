'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Image as ImageIcon, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SquarePhotoCrop, type SquarePhotoCropHandle } from '../SquarePhotoCrop'

export default function NewPostPage() {
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const cropRef = useRef<SquarePhotoCropHandle>(null)
  const router = useRouter()
  const supabase = useRef(createClient()).current

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
  }

  function removeImage() {
    setImageFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit() {
    if (submitting) return
    if (!text.trim() && !imageFile) return
    setSubmitting(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Sign in to post.')
      setSubmitting(false)
      return
    }

    let imageUrl: string | null = null

    if (imageFile) {
      let square: Blob
      try {
        square = await cropRef.current!.exportSquare()
      } catch {
        setError('Could not prepare the photo. Try again.')
        setSubmitting(false)
        return
      }
      const path = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(path, square, { contentType: 'image/jpeg' })

      if (uploadError) {
        setError('Could not upload the photo. Try again.')
        setSubmitting(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(path)
      imageUrl = publicUrl
    }

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text.trim() || null, image_url: imageUrl }),
    })

    if (res.ok) {
      router.push('/feed')
      router.refresh()
      return
    }
    setError('Could not publish the post. Try again.')
    setSubmitting(false)
  }

  const canPost = (text.trim().length > 0 || imageFile !== null) && !submitting

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors"
          >
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </button>
          <span className="font-display text-2xl tracking-wide">NEW POST</span>
          <button
            onClick={handleSubmit}
            disabled={!canPost}
            className="px-4 py-2 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Post'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          rows={5}
          className="w-full bg-brand-field border border-[#1a1a1a]/40 rounded-lg resize-none text-[#1a1a1a] text-base placeholder:text-[rgba(26,26,26,0.4)] outline-none leading-relaxed px-4 py-3"
          autoFocus
        />

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        {/* Image preview */}
        {imageFile && (
          <SquarePhotoCrop ref={cropRef} file={imageFile} onRemove={removeImage} />
        )}

        {/* Divider */}
        <div className="border-t border-brand-divider mt-6 pt-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[#1a1a1a] hover:border-[#1a1a1a]/60 transition-colors"
          >
            <ImageIcon size={18} />
            <span className="text-[10px] tracking-[0.15em] uppercase font-medium">Add photo</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
        </div>
      </div>
    </div>
  )
}
