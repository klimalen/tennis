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
      <div className="flex border-b border-brand-divider">
        {([
          { id: 'activity' as Tab, label: 'Activity' },
          { id: 'tour' as Tab, label: 'Tour' },
          { id: 'notifications' as Tab, label: 'Notifications' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-[10px] tracking-[0.2em] uppercase font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-[rgba(26,26,26,0.35)] hover:text-[rgba(26,26,26,0.6)]'
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
