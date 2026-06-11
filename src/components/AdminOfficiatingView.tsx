'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import type { Tournament, Umpire, Club } from '@/lib/types'
import ClubEditForm from './ClubEditForm'
import HelpPrompt from './help/HelpPrompt'
import UmpireEditForm from './UmpireEditForm'
import UmpireTournamentAssignmentDialog from './UmpireTournamentAssignmentDialog'

interface AdminOfficiatingViewProps {
  tournament: Tournament
}

type OfficiatingTab = 'officials' | 'umpires-registry' | 'clubs'

export default function AdminOfficiatingView({ tournament }: AdminOfficiatingViewProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<OfficiatingTab>('officials')
  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState<Club[]>([])
  const [umpires, setUmpires] = useState<Umpire[]>([])
  const [tournamentUmpires, setTournamentUmpires] = useState<Umpire[]>([])

  // Modal states
  const [editingClub, setEditingClub] = useState<Club | null>(null)
  const [isAddingClub, setIsAddingClub] = useState(false)
  const [editingUmpire, setEditingUmpire] = useState<Umpire | null>(null)
  const [isAddingUmpire, setIsAddingUmpire] = useState(false)
  const [isAssigningToTournament, setIsAssigningToTournament] = useState(false)

  const loadClubs = useCallback(async () => {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('name')
    if (error) {
      toast.error(`Error loading clubs: ${error.message}`)
      return
    }
    setClubs(data || [])
  }, [supabase])

  const loadUmpires = useCallback(async () => {
    const { data, error } = await supabase
      .from('umpires')
      .select('*, primary_club:clubs(*)')
      .order('name')
    if (error) {
      toast.error(`Error loading umpires: ${error.message}`)
      return
    }
    setUmpires(data || [])
  }, [supabase])

  const loadTournamentUmpires = useCallback(async () => {
    const { data, error } = await supabase
      .from('tournament_umpires')
      .select('umpire_id, umpires(*, primary_club:clubs(*))')
      .eq('tournament_id', tournament.id)
    
    if (error) {
      toast.error(`Error loading tournament officials: ${error.message}`)
      return
    }
    
    const list = (data || []).map((tu: any) => tu.umpires)
    setTournamentUmpires(list)
  }, [supabase, tournament.id])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadClubs(), loadUmpires(), loadTournamentUmpires()]).finally(() => {
      setLoading(false)
    })
  }, [loadClubs, loadUmpires, loadTournamentUmpires])

  const handleRemoveFromTournament = async (umpireId: string) => {
    if (!confirm('Are you sure you want to remove this official from the tournament? This will not delete them from the registry.')) {
      return
    }

    const { error } = await supabase
      .from('tournament_umpires')
      .delete()
      .eq('tournament_id', tournament.id)
      .eq('umpire_id', umpireId)

    if (error) {
      toast.error(`Could not remove official: ${error.message}`)
      return
    }

    toast.success('Official removed from tournament')
    loadTournamentUmpires()
  }

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Loading officiating data...</div>
  }

  // Calculate umpires not yet in this tournament
  const assignedIds = new Set(tournamentUmpires.map(u => u.id))
  const availableUmpires = umpires.filter(u => !assignedIds.has(u.id))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Officiating
            <HelpPrompt guideSlug="officiating" label="officiating" tip="Registries, tournament rosters, and match assignments" />
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage clubs, officials registry, and assignments for {tournament.name}.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex gap-6">
          {(['officials', 'umpires-registry', 'clubs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'pb-4 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-tm-orange text-tm-orange'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200',
              ].join(' ')}
            >
              {tab === 'officials' ? 'Tournament Officials' : tab === 'umpires-registry' ? 'Umpires Registry' : 'Clubs'}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'clubs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Clubs Registry</h3>
              <button 
                onClick={() => setIsAddingClub(true)}
                className="rounded-md bg-tm-orange px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-tm-orange-dark"
              >
                Add Club
              </button>
            </div>
            {/* Club list */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
               <table className="w-full text-left text-sm">
                 <thead>
                   <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                     <th className="px-4 py-2 font-semibold">Name</th>
                     <th className="px-4 py-2 font-semibold">Created</th>
                     <th className="px-4 py-2 font-semibold text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {clubs.map(club => (
                     <tr key={club.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                       <td className="px-4 py-3 font-medium">{club.name}</td>
                       <td className="px-4 py-3 text-zinc-500">{new Date(club.created_at).toLocaleDateString()}</td>
                       <td className="px-4 py-3 text-right">
                         <button 
                          onClick={() => setEditingClub(club)}
                          className="text-tm-orange hover:underline"
                        >
                          Edit
                        </button>
                       </td>
                     </tr>
                   ))}
                   {clubs.length === 0 && (
                     <tr>
                       <td colSpan={3} className="px-4 py-8 text-center text-zinc-500 italic">No clubs registered yet.</td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'umpires-registry' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Global Umpires Registry</h3>
              <button 
                onClick={() => setIsAddingUmpire(true)}
                className="rounded-md bg-tm-orange px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-tm-orange-dark"
              >
                Register Umpire
              </button>
            </div>
            {/* Umpires registry table */}
            <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
               <table className="w-full text-left text-sm">
                 <thead>
                   <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                     <th className="px-4 py-2 font-semibold">Name</th>
                     <th className="px-4 py-2 font-semibold">Qualification</th>
                     <th className="px-4 py-2 font-semibold">Club</th>
                     <th className="px-4 py-2 font-semibold text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {umpires.map(u => (
                     <tr key={u.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                       <td className="px-4 py-3 font-medium">{u.name}</td>
                       <td className="px-4 py-3">{u.qualification_level || 'N/A'}</td>
                       <td className="px-4 py-3">{u.primary_club?.name || 'Independent'}</td>
                       <td className="px-4 py-3 text-right">
                         <button 
                          onClick={() => setEditingUmpire(u)}
                          className="text-tm-orange hover:underline"
                        >
                          Edit
                        </button>
                       </td>
                     </tr>
                   ))}
                   {umpires.length === 0 && (
                     <tr>
                       <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 italic">No umpires registered yet.</td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'officials' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Tournament Officials</h3>
              <button 
                onClick={() => setIsAssigningToTournament(true)}
                className="rounded-md bg-tm-orange px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-tm-orange-dark"
              >
                Assign to Tournament
              </button>
            </div>
            {/* Tournament Umpires list */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tournamentUmpires.map(u => (
                <div key={u.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 dark:text-zinc-50">{u.name}</span>
                    <span className="rounded-full bg-tm-orange/10 px-2 py-0.5 text-[10px] font-bold uppercase text-tm-orange">
                      {u.qualification_level || 'Level 1'}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {u.primary_club?.name || 'Independent Official'}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button 
                      onClick={() => handleRemoveFromTournament(u.id)}
                      className="flex-1 rounded-md bg-zinc-100 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    >
                      Remove
                    </button>
                    <button className="flex-1 rounded-md bg-zinc-100 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700">
                      History
                    </button>
                  </div>
                </div>
              ))}
              {tournamentUmpires.length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
                  No officials assigned to this tournament yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {(isAddingClub || editingClub) && (
        <ClubEditForm
          mode={editingClub ? 'edit' : 'create'}
          club={editingClub ?? undefined}
          onCancel={() => {
            setIsAddingClub(false)
            setEditingClub(null)
          }}
          onSaved={() => {
            setIsAddingClub(false)
            setEditingClub(null)
            loadClubs()
          }}
        />
      )}

      {(isAddingUmpire || editingUmpire) && (
        <UmpireEditForm
          mode={editingUmpire ? 'edit' : 'create'}
          umpire={editingUmpire ?? undefined}
          clubs={clubs}
          onCancel={() => {
            setIsAddingUmpire(false)
            setEditingUmpire(null)
          }}
          onSaved={() => {
            setIsAddingUmpire(false)
            setEditingUmpire(null)
            loadUmpires()
            loadTournamentUmpires() // Refresh in case the edited umpire is in the tournament
          }}
        />
      )}

      {isAssigningToTournament && (
        <UmpireTournamentAssignmentDialog
          tournamentId={tournament.id}
          availableUmpires={availableUmpires}
          onCancel={() => setIsAssigningToTournament(false)}
          onAssigned={() => {
            setIsAssigningToTournament(false)
            loadTournamentUmpires()
          }}
        />
      )}
    </div>
  )
}
