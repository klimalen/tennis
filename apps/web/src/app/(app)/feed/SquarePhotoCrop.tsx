/* eslint-disable @next/next/no-img-element */
'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { MAX_ZOOM, OUTPUT_SIZE, clampFocus, coverScale, cropRect } from './square-crop'

export type SquarePhotoCropHandle = {
  exportSquare: () => Promise<Blob>
}

export const SquarePhotoCrop = forwardRef<SquarePhotoCropHandle, {
  file: File
  onRemove: () => void
  shape?: 'square' | 'circle'
}>(function SquarePhotoCrop({ file, onRemove, shape = 'square' }, ref) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ x: number; y: number; focus: { x: number; y: number } } | null>(null)
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [frame, setFrame] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [focus, setFocus] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    setNatural(null)
    setZoom(1)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const measure = () => setFrame(node.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = frameRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const next = zoom * (event.deltaY < 0 ? 1.06 : 0.94)
      setZoom(Math.min(MAX_ZOOM, Math.max(1, next)))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [zoom])

  function placedFocus(nextZoom = zoom, nextFocus = focus) {
    if (!natural || frame <= 0) return nextFocus
    return clampFocus(nextFocus, nextZoom, frame, natural.w, natural.h)
  }

  function pointerDistance() {
    const points = [...pointers.current.values()]
    const a = points[0]
    const b = points[1]
    if (!a || !b) return 0
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size >= 2) {
      drag.current = null
      pinch.current = { distance: pointerDistance(), zoom }
      return
    }
    drag.current = { x: event.clientX, y: event.clientY, focus: placedFocus() }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !natural || frame <= 0) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size >= 2 && pinch.current && pinch.current.distance > 0) {
      const next = pinch.current.zoom * (pointerDistance() / pinch.current.distance)
      setZoom(Math.min(MAX_ZOOM, Math.max(1, next)))
      return
    }
    if (!drag.current) return
    const scale = coverScale(frame, natural.w, natural.h) * zoom
    const dx = event.clientX - drag.current.x
    const dy = event.clientY - drag.current.y
    setFocus(placedFocus(zoom, {
      x: drag.current.focus.x - dx / scale,
      y: drag.current.focus.y - dy / scale,
    }))
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  useImperativeHandle(ref, () => ({
    async exportSquare() {
      const image = imageRef.current
      if (!image || !natural || frame <= 0) throw new Error('Photo is still loading')
      const rect = cropRect(focus, zoom, frame, natural.w, natural.h)
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not prepare the photo')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      ctx.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
      })
      if (!blob) throw new Error('Could not prepare the photo')
      return blob
    },
  }), [focus, frame, natural, zoom])

  const safeFocus = placedFocus()
  const scale = natural && frame > 0 ? coverScale(frame, natural.w, natural.h) * zoom : 0
  const left = natural ? frame / 2 - safeFocus.x * scale : 0
  const top = natural ? frame / 2 - safeFocus.y * scale : 0

  return (
    <div className="mt-4">
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative w-full aspect-square rounded-[20px] bg-[#1a1a1a] overflow-hidden touch-none cursor-grab active:cursor-grabbing"
      >
        {src && (
          <img
            ref={imageRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(event) => {
              const img = event.currentTarget
              setNatural({ w: img.naturalWidth, h: img.naturalHeight })
              setFocus({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 })
              setZoom(1)
            }}
            className="absolute max-w-none select-none pointer-events-none"
            style={natural ? {
              width: natural.w * scale,
              height: natural.h * scale,
              left,
              top,
            } : { visibility: 'hidden' }}
          />
        )}
        {shape === 'circle' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle closest-side, transparent 98%, rgba(26,26,26,0.55) 100%)' }}
          />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white"
        >
          <X size={14} />
        </button>
      </div>
      <label className="mt-3 flex items-center gap-3">
        <span className="text-[10px] tracking-[0.15em] uppercase font-medium text-[rgba(26,26,26,0.45)]">Zoom</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="flex-1 accent-[#E8748A]"
        />
      </label>
      <p className="mt-2 text-[10px] tracking-[0.12em] uppercase text-[rgba(26,26,26,0.35)]">
        {shape === 'circle' ? 'Drag to position your photo' : 'Drag to choose the square'}
      </p>
    </div>
  )
})
