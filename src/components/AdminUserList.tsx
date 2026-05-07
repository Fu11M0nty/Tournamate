'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/auth-context'
import type { UserRole } from '@/lib/types'

interface UserRow {
  id: string
  email: string
  role: UserRole
  created_at: string
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={[
        'inline-block rounded px-2 py-0.5 text-xs font-semibold',
        role === 'superadmin'
          ? 'bg-mk-red-soft text-mk-red'
          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
      ].join(' ')}
    >
      {role === 'superadmin' ? 'Superadmin' : 'Tournament Admin'}
    </span>
  )
}

export default function AdminUserList() {
  const { userId } = useAdminAuth()
  const supabase = useMemo(() => createClient(), [])

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [changingId, setChangingId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('list_users_with_roles')
    setLoading(false)
    if (error) {
      toast.error(`Could not load users: ${error.message}`)
      return
    }
    setUsers((data ?? []) as UserRow[])
  }, [supabase])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const superadminCount = useMemo(
    () => users.filter((u) => u.role === 'superadmin').length,
    [users],
  )

  async function handleRoleChange(targetId: string, newRole: UserRole) {
    setChangingId(targetId)
    const { error } = await supabase.rpc('set_user_role', {
      target_user_id: targetId,
      new_role: newRole,
    })
    setChangingId(null)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(
      newRole === 'superadmin'
        ? 'Promoted to Superadmin'
        : 'Changed to Tournament Admin',
    )
    await loadUsers()
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        No users found.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
              Email
            </th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
              Role
            </th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
              Joined
            </th>
            <th className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {users.map((user) => {
            const isSelf = user.id === userId
            const isChanging = changingId === user.id
            const isLastSuperadmin =
              user.role === 'superadmin' && superadminCount <= 1

            const canDemote = !isSelf && !isLastSuperadmin
            const canPromote = !isSelf

            const joined = new Date(user.created_at).toLocaleDateString(
              'en-GB',
              { day: 'numeric', month: 'short', year: 'numeric' },
            )

            return (
              <tr
                key={user.id}
                className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <td className="px-4 py-3 text-zinc-800 dark:text-zinc-200">
                  <span className="font-medium">{user.email}</span>
                  {isSelf && (
                    <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                      (you)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                  {joined}
                </td>
                <td className="px-4 py-3 text-right">
                  {isSelf ? (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      —
                    </span>
                  ) : user.role === 'tournament_admin' ? (
                    <button
                      type="button"
                      onClick={() => handleRoleChange(user.id, 'superadmin')}
                      disabled={!canPromote || !!changingId}
                      title="Promote to Superadmin"
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {isChanging ? 'Saving…' : 'Make Superadmin'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        handleRoleChange(user.id, 'tournament_admin')
                      }
                      disabled={!canDemote || !!changingId}
                      title={
                        isLastSuperadmin
                          ? 'Cannot demote the last superadmin'
                          : 'Remove Superadmin access'
                      }
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
                    >
                      {isChanging ? 'Saving…' : 'Remove Superadmin'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {users.length} user{users.length !== 1 ? 's' : ''} · {superadminCount} superadmin
        {superadminCount !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
