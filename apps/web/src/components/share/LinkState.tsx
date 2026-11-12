import Link from 'next/link'
import { ShareLinkButton } from '@/components/share/ShareLinkButton'

export function LinkState({
  title,
  body,
  action,
  share,
}: {
  title: string
  body: string
  action?: { href: string; label: string }
  share?: { path: string; title: string; text: string }
}) {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link href="/search" className="font-display text-2xl tracking-wide text-[#1a1a1a]">GAME.</Link>
          {share && <ShareLinkButton path={share.path} title={share.title} text={share.text} />}
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pt-10">
        <div className="rounded-[28px] bg-white px-6 py-10 text-center">
          <p className="font-display text-4xl tracking-wide text-[#1a1a1a]">{title}</p>
          <p className="mt-3 font-fraunces italic text-base text-[#497250]">{body}</p>
          {action && (
            <Link href={action.href} className="mt-6 inline-flex rounded-full bg-[#E8748A] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]">
              {action.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
