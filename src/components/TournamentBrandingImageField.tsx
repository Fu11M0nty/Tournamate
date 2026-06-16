'use client'

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  MAX_BRANDING_IMAGE_BYTES,
  TOURNAMENT_BRANDING_BUCKET,
} from '@/lib/branding'
import { createClient } from '@/lib/supabase'

interface TournamentBrandingImageFieldProps {
  tournamentId: string
  kind: 'logo' | 'sponsor'
  label: string
  description: string
  value: string
  onChange: (value: string) => void
}

export default function TournamentBrandingImageField({
  tournamentId,
  kind,
  label,
  description,
  value,
  onChange,
}: TournamentBrandingImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_BRANDING_IMAGE_BYTES) {
      toast.error('Image must be under 2 MB.')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${tournamentId}/${kind}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(TOURNAMENT_BRANDING_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      setUploading(false)
      toast.error(`Upload failed: ${uploadError.message}`)
      return
    }

    const { data } = supabase.storage
      .from(TOURNAMENT_BRANDING_BUCKET)
      .getPublicUrl(path)

    onChange(data.publicUrl)
    setUploading(false)
    toast.success('Image uploaded. Save general details to publish it.')
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void uploadFile(file)
  }

  return (
    <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-[5rem_1fr]">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          'No image'
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <div>
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
            {label}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>

        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Image URL
          <input
            type="url"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {uploading ? 'Uploading...' : 'Upload image'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
