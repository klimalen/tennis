'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Camera } from 'lucide-react'

const SKILL_OPTIONS = [
  { value: 1.0, label: '1.0 — Beginner' },
  { value: 1.5, label: '1.5 — Beginner+' },
  { value: 2.0, label: '2.0 — Novice' },
  { value: 2.5, label: '2.5 — Novice+' },
  { value: 3.0, label: '3.0 — Intermediate' },
  { value: 3.5, label: '3.5 — Intermediate+' },
  { value: 4.0, label: '4.0 — Advanced' },
  { value: 4.5, label: '4.5 — Advanced+' },
  { value: 5.0, label: '5.0 — Expert' },
  { value: 5.5, label: '5.5 — Expert+' },
  { value: 6.0, label: '6.0 — Pro' },
  { value: 6.5, label: '6.5 — Pro+' },
  { value: 7.0, label: '7.0 — Elite' },
]

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [skillLevel, setSkillLevel] = useState<number | ''>('')
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [originalUsername, setOriginalUsername] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/sign-in'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username, bio, avatar_url, skill_level_self')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name || '')
        setUsername(profile.username || '')
        setOriginalUsername(profile.username || '')
        setBio(profile.bio || '')
        setSkillLevel(profile.skill_level_self ?? '')
        setCurrentAvatarUrl(profile.avatar_url || null)
      }
      setLoading(false)
    }
    load()
  }, [])

  // Username availability check (debounced)
  useEffect(() => {
    if (!userId) return
    if (username === originalUsername) { setUsernameStatus('idle'); return }
    if (username.length < 3) { setUsernameStatus('idle'); return }

    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .neq('id', userId)
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [username, userId, originalUsername])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    } else {
      setAvatarFile(null)
      setAvatarPreview(null)
    }
  }

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }
  }, [avatarPreview])

  async function handleSave() {
    if (!userId) return
    if (usernameStatus === 'taken') { setError('Username is already taken'); return }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters'); return }

    setSaving(true)
    setError('')

    try {
      let avatarUrl = currentAvatarUrl

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${userId}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = publicUrl
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          username: username.trim(),
          bio: bio.trim() || null,
          skill_level_self: skillLevel || null,
          avatar_url: avatarUrl,
        })
        .eq('id', userId)

      if (updateError) throw updateError
      router.push('/me')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const displayAvatar = avatarPreview || currentAvatarUrl

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <ArrowLeft size={16} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Edit profile</h1>
          <button
            onClick={handleSave}
            disabled={saving || usernameStatus === 'taken'}
            className="px-4 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative w-24 h-24 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-4xl">👤</span>
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
              <Camera size={20} className="text-white" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-green-600 font-medium hover:underline"
          >
            Change photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="username"
              />
            </div>
            {usernameStatus === 'checking' && <p className="text-xs text-gray-400 mt-1">Checking...</p>}
            {usernameStatus === 'available' && <p className="text-xs text-green-600 mt-1">Available</p>}
            {usernameStatus === 'taken' && <p className="text-xs text-red-500 mt-1">Already taken</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder="Tell others about yourself..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skill level</label>
            <select
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="">Select your level</option>
              {SKILL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
