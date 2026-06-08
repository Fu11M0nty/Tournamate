'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import type { Umpire, Club } from '@/lib/types'

interface UmpireEditFormProps {
  mode: 'create' | 'edit'
  umpire?: Umpire
  clubs: Club[]
  onSaved: () => void
  onCancel: () => void
}

export default function UmpireEditForm({
  mode,
  umpire,
  clubs,
  onSaved,
  onCancel,
}: UmpireEditFormProps) {
  const [name, setName] = useState(umpire?.name ?? '')
  const [email, setEmail] = useState(umpire?.email ?? '')
  const [phone, setPhone] = useState(umpire?.phone ?? '')
  const [qualification, setQualification] = useState(umpire?.qualification_level ?? '')
  const [clubId, setClubId] = useState(umpire?.primary_club_id ?? '')
  const [bio, setBio] = useState(umpire?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }

    setSaving(true)
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      qualification_level: qualification.trim() || null,
      primary_club_id: clubId || null,
      bio: bio.trim() || null,
    }

    const { error } = mode === 'create'
      ? await supabase.from('umpires').insert(payload)
      : await supabase.from('umpires').update(payload).eq('id', umpire!.id)

    setSaving(false)

    if (error) {
      toast.error(`Could not save official: ${error.message}`)
      return
    }

    toast.success(mode === 'create' ? 'Official registered' : 'Official updated')
    onSaved()
  }

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4 text-center">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {mode === 'create' ? 'Register New Official' : 'Edit Official Profile'}
          </h2>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Qualification</label>
              <input
                type="text"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="e.g. Level 2 (Regional)"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Primary Club</label>
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">— Independent / None —</option>
                {clubs.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">Bio / Notes</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-tm-orange px-4 py-2 text-sm font-semibold text-white hover:bg-tm-orange-dark disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
