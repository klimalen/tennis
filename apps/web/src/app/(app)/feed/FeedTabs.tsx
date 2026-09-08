'use client'

import { useState } from 'react'
import { PostsFeed } from './PostsFeed'
import { FeedClient, type RequestItem, type FollowItem } from './FeedClient'
import type { PostItem } from './PostCard'

type Tab = 'feed' | 'activity'

interface Props {
  userId: string
  initialPosts: PostItem[]
  initialRequests: RequestItem[]
  initialFollows: FollowItem[]
  activityCount: number
}

export function FeedTabs({ userId, initialPosts, initialRequests, initialFollows, activityCount }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('feed')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-brand-divider">
        {([
          { id: 'feed' as Tab, label: 'Feed' },
          { id: 'activity' as Tab, label: 'Activity', badge: activityCount },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 flex items-center justify-center gap-2 text-[10px] tracking-[0.2em] uppercase font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-[rgba(26,26,26,0.35)] hover:text-[rgba(26,26,26,0.6)]'
            }`}
          >
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'feed' ? (
        <PostsFeed userId={userId} initialPosts={initialPosts} />
      ) : (
        <FeedClient userId={userId} initialRequests={initialRequests} initialFollows={initialFollows} />
      )}
    </div>
  )
}
