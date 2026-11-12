'use client'

export function CourtMapFrame({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const src = key
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=17&t=h&output=embed`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008},${lat - 0.008},${lng + 0.008},${lat + 0.008}&layer=mapnik&marker=${lat},${lng}`
  return (
    <div className="relative h-64 overflow-hidden rounded-[28px] bg-brand-surface">
      <iframe
        src={src}
        className="h-full w-full border-0"
        title={`Map of ${name}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}
