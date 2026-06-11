'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { ScoringSystem } from '@/lib/types'
import ScoringSystemForm from '@/components/ScoringSystemForm'
import HelpPrompt from '@/components/help/HelpPrompt'

export default function AdminScoringList() {
  const [systems, setSystems] = useState<ScoringSystem[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSystem, setEditingSystem] = useState<ScoringSystem | null>(null)
  
  const supabase = createClient()

  const fetchSystems = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('scoring_systems').select('*').order('created_at', { ascending: false })
    if (!error && data) setSystems(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchSystems()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateNew = () => {
    setEditingSystem(null)
    setIsFormOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Scoring Systems
            <HelpPrompt guideSlug="scoring" label="scoring systems" tip="Points, bonus points, forfeits, and tie-breakers" />
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Manage points logic and tie-breakers across different sports.</p>
        </div>
        {!isFormOpen && (
          <button onClick={handleCreateNew} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Template
          </button>
        )}
      </div>

      {isFormOpen ? (
        <ScoringSystemForm 
          initialData={editingSystem} 
          onSuccess={() => { setIsFormOpen(false); fetchSystems() }} 
          onCancel={() => setIsFormOpen(false)} 
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Name</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Sport</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Points (W-D-L)</th>
                <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Forfeit (Pts/Score)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-zinc-500 dark:text-zinc-400">Loading scoring templates...</td></tr>
              ) : systems.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-zinc-500 dark:text-zinc-400">No scoring templates found.</td></tr>
              ) : systems.map(system => (
                <tr key={system.id} className="transition-colors hover:bg-zinc-50 cursor-pointer dark:hover:bg-zinc-900" onClick={() => { setEditingSystem(system); setIsFormOpen(true); }}>
                  <td className="px-4 py-3 font-bold text-mk-red">{system.name}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{system.sport_type}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{system.win_pts} - {system.draw_pts} - {system.loss_pts}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{system.forfeit_win_pts} pts / {system.forfeit_win_score_for}-{system.forfeit_win_score_against}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}