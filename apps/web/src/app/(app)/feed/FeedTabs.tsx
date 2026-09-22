'use client'

import { useState } from 'react'
import { PostsFeed } from './PostsFeed'
import { FeedClient, type RequestItem, type FollowItem } from './FeedClient'
import { TourTab } from './TourTab'
import type { PostItem } from './PostCard'

type Tab = 'activity' | 'tour' | 'notifications'

interface Props {
  userId: string
  initialPosts: PostItem[]
  initialRequests: RequestItem[]
  initialFollows: FollowItem[]
  latestNotificationAt: string | null
}

const LAST_SEEN_KEY = 'notifications_last_seen'

export function FeedTabs({ userId, initialPosts, initialRequests, initialFollows, latestNotificationAt }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('activity')
  const [notificationsSeen, setNotificationsSeen] = useState(() => {
    if (typeof window === 'undefined') return true
    if (!latestNotificationAt) return true
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY)
    if (!lastSeen) return false
    return lastSeen >= latestNotificationAt
  })

  function handleTabClick(tab: Tab) {
    setActiveTab(tab)
    if (tab === 'notifications') {
      setNotificationsSeen(true)
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
    }
  }

  const showBadge = !notificationsSeen

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-2 px-4 pt-3 pb-1">
        {([
          { id: 'activity' as Tab, label: 'Activity' },
          { id: 'tour' as Tab, label: 'Tour' },
          { id: 'notifications' as Tab, label: 'Notifications' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex-1 py-2.5 rounded-full flex items-center justify-center gap-2 text-[10px] tracking-[0.16em] uppercase font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#1a1a1a] text-[#FAF7F2] border border-[#1a1a1a]'
                : 'bg-brand-field text-[#1a1a1a] border border-[#1a1a1a]/15 hover:border-[#1a1a1a]/35'
            }`}
          >
            {tab.label}
            {tab.id === 'notifications' && showBadge && (
              <span className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'activity' ? (
        <PostsFeed userId={userId} initialPosts={initialPosts} />
      ) : activeTab === 'tour' ? (
        <TourTab />
      ) : (
        <FeedClient userId={userId} initialRequests={initialRequests} initialFollows={initialFollows} />
      )}
    </div>
  )
}
