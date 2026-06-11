'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { useAdminAuth } from '@/lib/auth-context'
import { inviteOrganiser } from '@/lib/onboarding-actions'
import { mapOnboardingStatus, type OnboardingTone } from '@/lib/userOnboarding'
import type { UserRole } from '@/lib/types'

interface UserRow {
  id: string
  email: string
  role: UserRole
  is_approved: boolean
  created_at: string
  email_confirmed_at: string | null
  last_sign_in_at: string | null
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

const TONE_CLASSES: Record<OnboardingTone, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  zinc: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
}

function StatusBadge({ user }: { user: UserRow }) {
  const { label, tone } = mapOnboardingStatus(user)
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  )
}

function InviteOrganiserForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setLink(null)
    setCopied(false)
    const result = await inviteOrganiser(email)
    setSubmitting(false)
    if (!result.success) {
      toast.error(result.error ?? 'Could not invite organiser.')
      return
    }
    toast.success(
      result.alreadyExisted
        ? 'That organiser already had an account — approved and a reset link generated.'
        : 'Organiser invited. Copy the link below to send to them.',
    )
    setEmail('')
    setLink(result.actionLink ?? null)
    onInvited()
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Invite link copied')
    } catch {
      toast.error('Could not copy — select and copy the link manually.')
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invite an organiser</h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Creates an approved tournament organiser and gives you a link to send them. They set a
        password and land in the admin console — no Supabase dashboard needed.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="organiser@club.co.uk"
          autoComplete="off"
          className="w-full flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-mk-red focus:outline-none focus:ring-1 focus:ring-mk-red dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-mk-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mk-red-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Inviting…' : 'Invite organiser'}
        </button>
      </form>

      {link && (
        <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
          <p className="text-xs font-medium text-green-800 dark:text-green-300">
            Invite link — send this to the organiser:
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full flex-1 rounded border border-green-300 bg-white px-2 py-1.5 text-xs text-zinc-700 dark:border-green-800 dark:bg-zinc-900 dark:text-zinc-300"
            />
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-zinc-900 dark:text-green-400 dark:hover:bg-green-900"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminUserList() {
  const { userId, isSuperAdmin } = useAdminAuth()
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
      newRole === 'superadmin' ? 'Promoted to Superadmin' : 'Changed to Tournament Admin',
    )
    await loadUsers()
  }

  async function handleApprovalChange(targetId: string, approved: boolean) {
    setChangingId(targetId)
    const { error } = await supabase.rpc('set_user_approval', {
      target_user_id: targetId,
      approved,
    })
    setChangingId(null)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(approved ? 'Organiser approved' : 'Approval revoked')
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

  return (
    <div>
      {isSuperAdmin && <InviteOrganiserForm onInvited={loadUsers} />}

      {users.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          No users found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
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
                  Status
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
                const isLastSuperadmin = user.role === 'superadmin' && superadminCount <= 1

                const canDemote = !isSelf && !isLastSuperadmin
                const canPromote = !isSelf

                const joined = new Date(user.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })

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
                    <td className="px-4 py-3">
                      <StatusBadge user={user} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{joined}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Approve / revoke (superadmin only) */}
                        {isSuperAdmin && !isSelf && (
                          user.is_approved ? (
                            <button
                              type="button"
                              onClick={() => handleApprovalChange(user.id, false)}
                              disabled={!!changingId}
                              title="Revoke admin approval"
                              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900"
                            >
                              {isChanging ? 'Saving…' : 'Revoke'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleApprovalChange(user.id, true)}
                              disabled={!!changingId}
                              title="Approve as organiser"
                              className="rounded-md border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-800 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900"
                            >
                              {isChanging ? 'Saving…' : 'Approve'}
                            </button>
                          )
                        )}

                        {/* Promote / demote */}
                        {isSelf ? (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
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
                            onClick={() => handleRoleChange(user.id, 'tournament_admin')}
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
                      </div>
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
      )}
    </div>
  )
}
