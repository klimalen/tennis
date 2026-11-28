'use client'

import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { POST_PHOTO_MAX } from '@/lib/post-limits'

export function PostPhotoPicker({
  photos,
  onAdd,
  onRemove,
  max = POST_PHOTO_MAX,
}: {
  photos: { id: string; src: string }[]
  onAdd: (files: FileList | null) => void
  onRemove: (id: string) => void
  max?: number
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-[#1a1a1a]">Photos</p>
        <p className="text-[11px] text-[rgba(26,26,26,0.4)]">Optional</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative h-[88px] w-[88px] overflow-hidden rounded-2xl bg-brand-field">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(photo.id)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-[88px] w-[88px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#1a1a1a]/25 text-[rgba(26,26,26,0.45)] hover:border-[#1a1a1a]/50"
          >
            <ImagePlus size={16} />
            <span className="text-[9px] uppercase tracking-[0.12em]">Add photos</span>
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          onAdd(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
