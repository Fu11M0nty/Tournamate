import { AdminAuthProvider } from '@/lib/auth-context'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { UserRole } from '@/lib/types'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: UserRole | null = null
  let isApproved = false
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_approved')
      .eq('id', user.id)
      .single()
    role = (profile?.role as UserRole) ?? null
    isApproved = profile?.is_approved === true
  }

  return (
    <AdminAuthProvider
      initialUserId={user?.id ?? null}
      initialRole={role}
      initialIsApproved={isApproved}
    >
      {children}
    </AdminAuthProvider>
  )
}
