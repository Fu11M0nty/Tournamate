'use client'

import type { UserRole } from '@/lib/types'

export type AdminPanel = 'match-entry' | 'schedule' | 'age-groups' | 'import' | 'snapshots' | 'users'

interface AdminSidebarProps {
  isOpen: boolean
  onClose: () => void
  activePanel: AdminPanel
  onNavigate: (panel: AdminPanel) => void
  onScanQR: () => void
  onBackup: () => void
  backingUp: boolean
  role: UserRole | null
}

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-mk-red-soft text-mk-red'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}

function ActionNavItem({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {icon}
      {label}
    </button>
  )
}

export default function AdminSidebar({
  isOpen,
  onClose,
  activePanel,
  onNavigate,
  onScanQR,
  role,
}: AdminSidebarProps) {
  const isSuperAdmin = role === 'superadmin'
  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 flex w-56 flex-col',
        'border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
        'transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:relative lg:z-auto lg:translate-x-0',
      ].join(' ')}
    >
      {/* Branding + close */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md transition-opacity hover:opacity-75"
            title="Open TournaMate homepage"
          >
            <svg viewBox="420 0 560 500" className="h-8 w-8 shrink-0" aria-hidden="true">
              <image href="/Tournamate-removebg-preview2.svg" x="0" y="0" width="1436" height="696"/>
            </svg>
            <span className="text-sm font-black leading-none tracking-tight">
              <span style={{ color: '#4a9fd4' }}>Tourna</span><span style={{ color: '#f47c20' }}>Mate</span>
            </span>
          </a>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Admin Console
          </p>
          {role && (
            <span
              className={[
                'mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                isSuperAdmin
                  ? 'bg-mk-red-soft text-mk-red'
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
              ].join(' ')}
            >
              {isSuperAdmin ? 'Superadmin' : 'Tournament Admin'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 lg:hidden"
          aria-label="Close menu"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Fixture View
        </p>

        <NavItem
          label="Match Entry"
          active={activePanel === 'match-entry'}
          onClick={() => onNavigate('match-entry')}
          icon={
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />

        <ActionNavItem
          label="Scan QR"
          onClick={onScanQR}
          icon={
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3z" />
              <path d="M17 17h4" />
              <path d="M17 14v3" />
              <path d="M20 14v7" />
              <path d="M14 20h3" />
            </svg>
          }
        />

        <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Manage
        </p>

        <NavItem
          label="Schedule"
          active={activePanel === 'schedule'}
          onClick={() => onNavigate('schedule')}
          icon={
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <NavItem
          label="Age Groups"
          active={activePanel === 'age-groups'}
          onClick={() => onNavigate('age-groups')}
          icon={
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <NavItem
          label="Bulk Import"
          active={activePanel === 'import'}
          onClick={() => onNavigate('import')}
          icon={
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          }
        />
        <NavItem
          label="Snapshots"
          active={activePanel === 'snapshots'}
          onClick={() => onNavigate('snapshots')}
          icon={
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          }
        />

        {isSuperAdmin && (
          <>
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Admin
            </p>
            <NavItem
              label="Users"
              active={activePanel === 'users'}
              onClick={() => onNavigate('users')}
              icon={
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />
          </>
        )}
      </nav>
    </aside>
  )
}
