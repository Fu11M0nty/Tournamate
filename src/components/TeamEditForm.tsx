'use client'

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import TeamLogo from './TeamLogo'
import type { Team } from '@/lib/types'

interface TeamEditFormProps {
  team?: Team
  ageGroupId: string
  ageGroupName: string
  onSave: () => void
  onCancel: () => void
}

const LOGO_BUCKET = 'team-logos'
const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB

export default function TeamEditForm({
  team,
  ageGroupId,
  ageGroupName,
  onSave,
  onCancel,
}: TeamEditFormProps) {
  const isCreate = !team
  const [name, setName] = useState(team?.name ?? '')
  const [shortName, setShortName] = useState(team?.short_name ?? '')
  const [color, setColor] = useState(team?.color ?? '#52525b')
  const [logoUrl, setLogoUrl] = useState<string | null>(team?.logo_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const submitDisabled = saving || uploading || name.trim() === ''

  const previewTeam: Team = {
    id: team?.id ?? 'new',
    age_group_id: ageGroupId,
    name: name || team?.name || 'New team',
    short_name: shortName || null,
    color,
    logo_url: logoUrl,
    deleted_at: null,
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo must be under 2 MB.')
      e.target.value = ''
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${team?.id ?? 'pending'}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      setUploading(false)
      toast.error(`Upload failed: ${uploadError.message}`)
      e.target.value = ''
      return
    }

    const { data: publicUrl } = supabase.storage
      .from(LOGO_BUCKET)
      .getPublicUrl(path)

    setLogoUrl(publicUrl.publicUrl)
    setUploading(false)
    e.target.value = ''
    toast.success('Logo uploaded')
  }

  function handleRemoveLogo() {
    setLogoUrl(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (name.trim() === '') {
      toast.error('Team name is required.')
      return
    }

    const payload = {
      name: name.trim(),
      short_name: shortName.trim() === '' ? null : shortName.trim(),
      color,
      logo_url: logoUrl,
      age_group_id: ageGroupId,
    }

    setSaving(true)
    const { data, error } = isCreate
      ? await supabase.from('teams').insert(payload).select()
      : await supabase
          .from('teams')
          .update(payload)
          .eq('id', team!.id)
          .select()

    setSaving(false)

    if (error) {
      toast.error(`Could not save: ${error.message}`)
      return
    }
    if (!data || data.length === 0) {
      toast.error(
        isCreate
          ? 'Insert blocked by RLS — check teams_auth_insert policy.'
          : 'Update blocked by RLS — check teams_auth_update policy.'
      )
      return
    }

    toast.success(isCreate ? 'Team added' : 'Team saved')
    onSave()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-mk-red dark:text-mk-red">
            {ageGroupName}
          </p>
          <h2
            id="team-edit-title"
            className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50"
          >
            {isCreate ? 'Add team' : 'Edit team'}
          </h2>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <TeamLogo team={previewTeam} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {previewTeam.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Live preview
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="team-name"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Name
            </label>
            <input
              id="team-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div>
            <label
              htmlFor="team-short-name"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Short name{' '}
              <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="team-short-name"
              type="text"
              maxLength={6}
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="e.g. STORM"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm uppercase tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div>
            <label
              htmlFor="team-color"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Colour
            </label>
            <div className="flex items-center gap-2">
              <input
                id="team-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                pattern="^#[0-9a-fA-F]{6}$"
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Logo
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {uploading ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={uploading}
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Remove
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              PNG or SVG, square, under 2&nbsp;MB. Uploads go to the{' '}
              <code className="font-mono">{LOGO_BUCKET}</code> Supabase Storage
              bucket.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving || uploading}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="flex-1 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
