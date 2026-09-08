'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PostCard, type PostItem } from './PostCard'

interface Props {
  userId: string
  initialPosts: PostItem[]
}

export function PostsFeed({ userId, initialPosts }: Props) {
  const [posts, setPosts] = useState<PostItem[]>(initialPosts)
  const supabase = useRef(createClient()).current

  useEffect(() => {
    // Listen for new posts from people I follow + my own
    const channel = supabase
      .channel('posts-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const newPost = payload.new as { id: string; author_id: string }

          // Fetch full post with author + related data
          const { data } = await supabase
            .from('posts')
            .select(`
              id, type, body, image_url, created_at, updated_at,
              author:profiles!author_id (id, full_name, username, avatar_url),
              match_result:match_results (
                id, winner_id, winning_team, played_at,
                winner:profiles!winner_id (full_name, username),
                game:games (format, scheduled_at)
              ),
              game:games (
                id, format, scheduled_at, skill_level_min, skill_level_max,
                neighborhood, status, max_players, is_open,
                city:cities (name)
              ),
              likes:post_likes (count)
            `)
            .eq('id', newPost.id)
            .single()

          if (!data) return

          // Only show posts from self or following
          if (newPost.author_id !== userId) {
            const { data: follow } = await supabase
              .from('follows')
              .select('follower_id')
              .eq('follower_id', userId)
              .eq('following_id', newPost.author_id)
              .maybeSingle()
            if (!follow) return
          }

          const likes = data.likes as unknown as [{ count: number }] | []
          const post: PostItem = {
            ...(data as unknown as Omit<PostItem, 'likes_count' | 'liked_by_me'>),
            likes_count: likes[0]?.count ?? 0,
            liked_by_me: false,
          }

          setPosts((prev) => [post, ...prev])
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  function removePost(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">No posts yet</p>
        <p className="text-sm text-[rgba(26,26,26,0.4)] max-w-xs font-script italic">
          Follow players to see their posts here, or create your first post.
        </p>
      </div>
    )
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={userId}
          onDeleted={removePost}
        />
      ))}
    </div>
  )
}
