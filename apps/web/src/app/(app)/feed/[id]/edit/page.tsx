'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Image as ImageIcon, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { SquarePhotoCrop, type SquarePhotoCropHandle } from '../../SquarePhotoCrop'

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>()
  const [text, setText] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cropRef = useRef<SquarePhotoCropHandle>(null)
  const router = useRouter()
  const supabase = useRef(createClient()).current

  useEffect(() => {
    supabase.from('posts').select('body, image_url').eq('id', id).single().then(({ data }) => {
      if (data) {
        setText(data.body ?? '')
        setImageUrl(data.image_url)
      }
      setLoading(false)
    })
  }, [id, supabase])

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNewImageFile(file)
  }

  function removeImage() {
    setImageUrl(null)
    setNewImageFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    let finalImageUrl = imageUrl

    if (newImageFile) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSubmitting(false); return }
      let square: Blob
      try {
        square = await cropRef.current!.exportSquare()
      } catch {
        setSubmitting(false)
        return
      }
      const path = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('post-images').upload(path, square, { contentType: 'image/jpeg' })
      if (uploadError) { setSubmitting(false); return }
      const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path)
      finalImageUrl = publicUrl
    }

    await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text.trim() || null, image_url: finalImageUrl }),
    })

    router.push('/feed')
    router.refresh()
    setSubmitting(false)
  }

  const displayImage = newImageFile ? null : imageUrl
  const hasPhoto = newImageFile !== null || imageUrl !== null
  const canPost = (text.trim().length > 0 || hasPhoto) && !submitting

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-brand-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
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

      <div className="max-w-2xl mx-auto px-4 py-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          rows={5}
          className="font-copy w-full bg-brand-field border border-[#1a1a1a]/40 rounded-lg resize-none text-[#1a1a1a] text-base placeholder:text-[rgba(26,26,26,0.4)] outline-none leading-relaxed px-4 py-3"
          autoFocus
        />

        {newImageFile && (
          <SquarePhotoCrop ref={cropRef} file={newImageFile} onRemove={removeImage} />
        )}

        {displayImage && (
          <div className="relative mt-4 w-full aspect-square rounded-[20px] bg-brand-field overflow-hidden">
            <Image src={displayImage} alt="Preview" fill className="object-cover" />
            <button onClick={removeImage} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="border-t border-brand-divider mt-6 pt-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[#1a1a1a] hover:border-[#1a1a1a]/60 transition-colors"
          >
            <ImageIcon size={18} />
            <span className="text-[10px] tracking-[0.15em] uppercase font-medium">
              {hasPhoto ? 'Change photo' : 'Add photo'}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
        </div>
      </div>
    </div>
  )
}
