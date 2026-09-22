'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

export default function NewPostPage() {
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = useRef(createClient()).current

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
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
      const ext = imageFile.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(path, imageFile, { contentType: imageFile.type })

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
    <div className="min-h-screen pb-20 md:pb-0">
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
        {imagePreview && (
          <div className="relative mt-4 w-full aspect-video rounded-[20px] bg-brand-field overflow-hidden">
            <Image src={imagePreview} alt="Preview" fill className="object-cover" />
            <button
              onClick={removeImage}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white"
            >
              <X size={14} />
            </button>
          </div>
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
