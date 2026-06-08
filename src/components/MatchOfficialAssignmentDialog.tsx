'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import type { Umpire, UmpireAssignment, UmpireRole } from '@/lib/types'

interface MatchOfficialAssignmentDialogProps {
  matchId: string
  tournamentId: string
  onSaved: () => void
  onCancel: () => void
}

const ROLES: { value: UmpireRole; label: string }[] = [
  { value: 'head', label: 'Umpire 1 (Head)' },
  { value: 'assistant', label: 'Umpire 2' },
  { value: 'scorer', label: 'Scorer' },
  { value: 'assessor', label: 'Assessor' },
]

export default function MatchOfficialAssignmentDialog({
  matchId,
  tournamentId,
  onSaved,
  onCancel,
}: MatchOfficialAssignmentDialogProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tournamentUmpires, setTournamentUmpires] = useState<Umpire[]>([])
  const [assignments, setAssignments] = useState<Partial<Record<UmpireRole, string>>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    
    // 1. Load tournament umpires
    const { data: tuData, error: tuError } = await supabase
      .from('tournament_umpires')
      .select('umpires(*, primary_club:clubs(*))')
      .eq('tournament_id', tournamentId)
    
    if (tuError) {
      toast.error(`Error loading officials: ${tuError.message}`)
    } else {
      setTournamentUmpires((tuData || []).map((tu: { umpires: any }) => tu.umpires))
    }

    // 2. Load existing assignments for this match
    const { data: aData, error: aError } = await supabase
      .from('umpire_assignments')
      .select('role, umpire_id')
      .eq('match_id', matchId)
    
    if (aError) {
      toast.error(`Error loading assignments: ${aError.message}`)
    } else {
      const initialAssignments: Partial<Record<UmpireRole, string>> = {}
      ;(aData || []).forEach((a: any) => {
        initialAssignments[a.role as UmpireRole] = a.umpire_id
      })
      setAssignments(initialAssignments)
    }

    setLoading(false)
  }, [supabase, tournamentId, matchId])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleSave() {
    setSaving(true)

    // Prepare all operations
    // For simplicity, we'll delete all existing and re-insert
    // But a more precise way is better. Let's do a simple approach first.
    
    const { error: deleteError } = await supabase
      .from('umpire_assignments')
      .delete()
      .eq('match_id', matchId)

    if (deleteError) {
      toast.error(`Could not update assignments: ${deleteError.message}`)
      setSaving(false)
      return
    }

    const newAssignments = Object.entries(assignments)
      .filter(([_, umpireId]) => !!umpireId)
      .map(([role, umpireId]) => ({
        match_id: matchId,
        umpire_id: umpireId,
        role: role as UmpireRole,
      }))

    if (newAssignments.length > 0) {
      const { error: insertError } = await supabase
        .from('umpire_assignments')
        .insert(newAssignments)

      if (insertError) {
        toast.error(`Could not save assignments: ${insertError.message}`)
        setSaving(false)
        return
      }
    }

    toast.success('Assignments updated')
    setSaving(false)
    onSaved()
  }

  const handleRoleChange = (role: UmpireRole, umpireId: string) => {
    setAssignments(prev => ({
      ...prev,
      [role]: umpireId || undefined
    }))
  }

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="mb-6">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Assign Match Officials
          </h2>
          <p className="text-sm text-zinc-500">
            Select officials from the tournament roster for each role.
          </p>
        </header>

        {loading ? (
          <div className="py-8 text-center text-zinc-500">Loading officials...</div>
        ) : (
          <div className="space-y-4">
            {ROLES.map(role => (
              <div key={role.value}>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {role.label}
                </label>
                <select
                  value={assignments[role.value] || ''}
                  onChange={(e) => handleRoleChange(role.value, e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">— Unassigned —</option>
                  {tournamentUmpires.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.qualification_level || 'L1'})
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {tournamentUmpires.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                No officials have been assigned to this tournament yet. Go to the <strong>Officiating</strong> tab to build your roster.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 rounded-md bg-tm-orange px-4 py-2 text-sm font-semibold text-white hover:bg-tm-orange-dark disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  )
}
