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
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    role = (profile?.role as UserRole) ?? null
  }

  return (
    <AdminAuthProvider initialUserId={user?.id ?? null} initialRole={role}>
      {children}
    </AdminAuthProvider>
  )
}
