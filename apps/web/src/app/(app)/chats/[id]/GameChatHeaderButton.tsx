'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IdCard, Loader2 } from 'lucide-react'
import { GameDetailSheet, loadGameDetail, type GameDetail } from '@/components/games/GameDetailSheet'

export function GameChatHeaderButton({
  gameId,
  userId,
  conversationId,
}: {
  gameId: string
  userId: string
  conversationId: string
}) {
  const [opening, setOpening] = useState(false)
  const [game, setGame] = useState<GameDetail | null>(null)

  async function openGameCard() {
    if (opening) return
    setOpening(true)
    const detail = await loadGameDetail(gameId)
    setOpening(false)
    if (detail) setGame(detail)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openGameCard()}
        disabled={opening}
        aria-label="Open game"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#1a1a1a]/15 bg-brand-field text-[rgba(26,26,26,0.7)] transition-colors hover:bg-[#F4F1EC] disabled:opacity-50"
      >
        {opening ? <Loader2 size={16} className="animate-spin" /> : <IdCard size={16} />}
      </button>
      {game && createPortal(
        <GameDetailSheet
          game={game}
          currentUserId={userId}
          activeConversationId={conversationId}
          onClose={() => setGame(null)}
        />,
        document.body,
      )}
    </>
  )
}
