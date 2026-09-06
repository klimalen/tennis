'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, LogOut, Trash2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteAccount } from './actions'

export default function SettingsPage() {
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
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
    try {
      await deleteAccount()
    } catch {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Account section */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <LogOut size={16} className="text-gray-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">
              {signingOut ? 'Signing out...' : 'Sign out'}
            </span>
          </button>
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-red-50">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Danger zone</p>
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
              <p className="text-xs text-gray-400 mt-0.5">Permanently remove your account and all data</p>
            </div>
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Delete account</h2>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              This will permanently delete your profile, matches, and all data. This action cannot be undone.
            </p>

            <p className="text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-bold text-red-600">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput('') }}
                disabled={deleting}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleting}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
