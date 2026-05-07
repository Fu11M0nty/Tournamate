'use client'

import { createContext, useContext } from 'react'
import type { UserRole } from './types'

interface AdminAuthContextValue {
  userId: string | null
  role: UserRole | null
  isSuperAdmin: boolean
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  userId: null,
  role: null,
  isSuperAdmin: false,
})

interface AdminAuthProviderProps {
  children: React.ReactNode
  initialUserId: string | null
  initialRole: UserRole | null
}

/**
 * Provides the authenticated user's ID and role to the admin console.
 * Initial values are resolved server-side in the admin layout — no loading state.
 */
export function AdminAuthProvider({
  children,
  initialUserId,
  initialRole,
}: AdminAuthProviderProps) {
  return (
    <AdminAuthContext.Provider
      value={{
        userId: initialUserId,
        role: initialRole,
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
