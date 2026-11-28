'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { PostCard } from './PostCard'
import { showGamePost } from '@/lib/game-visibility'
import { viewerCanOpenRecapGame } from '@/lib/game-recap'
import { attachRecapPlayers, mapPostRow, POST_FEED_SELECT, shownInFeed, type PostItem } from '@/lib/post-feed'

async function withRecapAccess(supabase: SupabaseClient, userId: string, post: PostItem): Promise<PostItem> {
  if (post.type !== 'game_recap' || !post.game) return post
  let mutual = false
  if (post.game.creator_id !== userId) {
    const [{ data: outgoing }, { data: incoming }] = await Promise.all([
      supabase.from('follows').select('follower_id').eq('follower_id', userId).eq('following_id', post.game.creator_id).maybeSingle(),
      supabase.from('follows').select('follower_id').eq('follower_id', post.game.creator_id).eq('following_id', userId).maybeSingle(),
    ])
    mutual = Boolean(outgoing && incoming)
  }
  return {
    ...post,
    can_open_game: viewerCanOpenRecapGame(post.game, post.recap_player_ids, userId, mutual),
  }
}

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
            .select(POST_FEED_SELECT)
            .eq('id', newPost.id)
            .maybeSingle()

          if (!data) return
          const mapped = mapPostRow(data as never, false)
          if (!shownInFeed(mapped)) return
          if (mapped.type === 'open_game' && !showGamePost(mapped.game)) return

          // Only show posts from self or following. Friends-only recaps are already
          // hidden by row security unless the follow is mutual.
          if (newPost.author_id !== userId) {
            const { data: follow } = await supabase
              .from('follows')
              .select('follower_id')
              .eq('follower_id', userId)
              .eq('following_id', newPost.author_id)
              .maybeSingle()
            if (!follow) return
          }

          const [hydrated] = await attachRecapPlayers(supabase, [mapped])
          const post = hydrated ? await withRecapAccess(supabase, userId, hydrated) : null
          if (!post) return
          setPosts((prev) => prev.some((item) => item.id === post.id) ? prev : [post, ...prev])
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        async (payload) => {
          const updatedId = (payload.new as { id?: string }).id
          if (!updatedId) return
          const { data } = await supabase
            .from('posts')
            .select(POST_FEED_SELECT)
            .eq('id', updatedId)
            .maybeSingle()
          if (!data) {
            setPosts((prev) => prev.filter((item) => item.id !== updatedId))
            return
          }
          const mapped = mapPostRow(data as never, false)
          if (!shownInFeed(mapped) || (mapped.type === 'open_game' && !showGamePost(mapped.game))) {
            setPosts((prev) => prev.filter((item) => item.id !== updatedId))
            return
          }
          const authorId = mapped.author.id
          if (authorId !== userId) {
            const { data: follow } = await supabase
              .from('follows')
              .select('follower_id')
              .eq('follower_id', userId)
              .eq('following_id', authorId)
              .maybeSingle()
            if (!follow) {
              setPosts((prev) => prev.filter((item) => item.id !== updatedId))
              return
            }
          }
          const [hydrated] = await attachRecapPlayers(supabase, [mapped])
          const post = hydrated ? await withRecapAccess(supabase, userId, hydrated) : null
          if (!post) return
          setPosts((prev) => {
            const existing = prev.find((item) => item.id === updatedId)
            const next = { ...post, liked_by_me: existing?.liked_by_me ?? false }
            if (!existing) return [next, ...prev]
            return prev.map((item) => item.id === updatedId ? next : item)
          })
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
          Follow players to see their posts here, or create your first post
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4">
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
