'use client'

import { createContext, useContext } from 'react'
import type { UserRole } from './types'

interface AdminAuthContextValue {
  userId: string | null
  role: UserRole | null
  isApproved: boolean
  isSuperAdmin: boolean
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  userId: null,
  role: null,
  isApproved: false,
  isSuperAdmin: false,
})

interface AdminAuthProviderProps {
  children: React.ReactNode
  initialUserId: string | null
  initialRole: UserRole | null
  initialIsApproved: boolean
}

/**
 * Provides the authenticated user's ID and role to the admin console.
 * Initial values are resolved server-side in the admin layout — no loading state.
 */
export function AdminAuthProvider({
  children,
  initialUserId,
  initialRole,
  initialIsApproved,
}: AdminAuthProviderProps) {
  return (
    <AdminAuthContext.Provider
      value={{
        userId: initialUserId,
        role: initialRole,
        isApproved: initialIsApproved,
        isSuperAdmin: initialRole === 'superadmin',
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth(): AdminAuthContextValue {
  return useContext(AdminAuthContext)
}
