'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, LogOut, Trash2, AlertTriangle, Pencil, LifeBuoy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
export default function SettingsPage() {
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/search')
    router.refresh()
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return
    setDeleting(true)
    setDeleteError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: files } = await supabase.storage.from('support-images').list(user.id)
      if (files?.length) {
        await supabase.storage.from('support-images').remove(files.map((file) => `${user.id}/${file.name}`))
      }
    }
    const { error } = await supabase.rpc('delete_current_user')
    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors"
          >
            <ChevronLeft size={20} className="text-[rgba(26,26,26,0.5)]" />
          </button>
          <span className="font-display text-5xl tracking-wide">SETTINGS</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Account section */}
        <div className="bg-white rounded-[28px] overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-divider">
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Account</p>
          </div>
          <Link
            href="/me/edit"
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-brand-surface transition-colors text-left border-b border-brand-divider"
          >
            <div className="w-9 h-9 rounded-full bg-brand-field flex items-center justify-center flex-shrink-0">
              <Pencil size={16} className="text-[#1a1a1a]" />
            </div>
            <div>
              <span className="block text-sm font-medium text-[#1a1a1a]">Edit profile</span>
              <span className="block text-[11px] text-[rgba(26,26,26,0.45)]">City, level and schedule</span>
            </div>
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-brand-surface transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-brand-field flex items-center justify-center flex-shrink-0">
              <LogOut size={16} className="text-[#1a1a1a]" />
            </div>
            <span className="text-sm font-medium text-[#1a1a1a]">
              {signingOut ? 'Signing out...' : 'Sign out'}
            </span>
          </button>
        </div>

        <div className="bg-white rounded-[28px] overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-divider">
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Help</p>
          </div>
          <Link
            href="/settings/support"
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-brand-surface transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-brand-field flex items-center justify-center flex-shrink-0">
              <LifeBuoy size={16} className="text-[#1a1a1a]" />
            </div>
            <div>
              <span className="block text-sm font-medium text-[#1a1a1a]">Support</span>
              <span className="block text-[11px] text-[rgba(26,26,26,0.45)]">Send a note and a photo</span>
            </div>
          </Link>
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-[28px] overflow-hidden">
          <div className="px-4 py-3 border-b border-red-100">
            <p className="text-[9px] tracking-[0.2em] uppercase text-red-400">Danger zone</p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <Trash2 size={16} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-600">Delete account</p>
              <p className="text-xs text-[rgba(26,26,26,0.4)] mt-0.5">Permanently remove your account and all data</p>
            </div>
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <span className="font-display text-2xl tracking-wide">DELETE ACCOUNT</span>
            </div>

            <p className="text-sm text-[rgba(26,26,26,0.5)] mb-4">
              This will permanently delete your profile, matches, and all data. This action cannot be undone.
            </p>

            <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-2">
              Type <span className="font-bold text-red-600">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="w-full px-4 py-2.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent mb-4"
            />

            {deleteError && (
              <p className="text-xs text-red-500 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-full bg-brand-field border border-[#1a1a1a]/40 text-sm font-medium text-[#1a1a1a] hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleting}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
