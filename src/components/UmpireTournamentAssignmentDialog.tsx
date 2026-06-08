'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import type { Umpire } from '@/lib/types'

interface UmpireTournamentAssignmentDialogProps {
  tournamentId: string
  availableUmpires: Umpire[]
  onAssigned: () => void
  onCancel: () => void
}

export default function UmpireTournamentAssignmentDialog({
  tournamentId,
  availableUmpires,
  onAssigned,
  onCancel,
}: UmpireTournamentAssignmentDialogProps) {
  const [selectedUmpireIds, setSelectedUmpireIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleAssign() {
    if (selectedUmpireIds.length === 0) {
      toast.error('Please select at least one official.')
      return
    }

    setSaving(true)
    const payload = selectedUmpireIds.map(id => ({
      tournament_id: tournamentId,
      umpire_id: id,
    }))

    const { error } = await supabase
      .from('tournament_umpires')
      .insert(payload)

    setSaving(false)

    if (error) {
      toast.error(`Could not assign officials: ${error.message}`)
      return
    }

    toast.success('Officials assigned to tournament')
    onAssigned()
  }

  const toggleUmpire = (id: string) => {
    setSelectedUmpireIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    )
  }

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            Assign Officials to Tournament
          </h2>
          <p className="text-sm text-zinc-500">
            Select officials from the global registry to add to this tournament&apos;s roster.
          </p>
        </header>

        <div className="max-h-[300px] overflow-y-auto border border-zinc-200 rounded-md dark:border-zinc-800">
          {availableUmpires.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500 italic">
              All registered officials are already assigned to this tournament.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {availableUmpires.map(u => (
                <label 
                  key={u.id} 
                  className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedUmpireIds.includes(u.id)}
                    onChange={() => toggleUmpire(u.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-tm-orange focus:ring-tm-orange"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{u.name}</span>
                    <span className="text-xs text-zinc-500">
                      {u.qualification_level || 'No qualification listed'} • {u.primary_club?.name || 'Independent'}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={saving || availableUmpires.length === 0}
            className="flex-1 rounded-md bg-tm-orange px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-tm-orange-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Assigning...' : `Assign ${selectedUmpireIds.length > 0 ? `(${selectedUmpireIds.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
