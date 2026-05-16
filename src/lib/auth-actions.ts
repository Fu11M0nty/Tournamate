'use server'

import { headers } from 'next/headers'
import { createServerSupabaseClient } from './supabase'

export async function signInWithDevAdmin() {
  if (process.env.NODE_ENV !== 'development' || process.env.VERCEL) {
    return { success: false, error: 'Dev admin login is only available in local development.' }
  }

  const headersList = await headers()
  const host = headersList.get('host') ?? ''
  const isLocalhost =
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:') ||
    host.startsWith('[::1]:')

  if (!isLocalhost) {
    return { success: false, error: 'Dev admin login is only available from localhost.' }
  }

  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!email || !password || email === 'your-admin-email@example.com') {
    return {
      success: false,
      error: 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local, then restart the dev server.',
    }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    return { success: false, error: error?.message ?? 'Could not sign in as dev admin.' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_approved')
    .eq('id', data.user.id)
    .single()

  const isAdminRole =
    profile?.role === 'superadmin' || profile?.role === 'tournament_admin'
  const isApproved = profile?.is_approved === true

  if (!isAdminRole || !isApproved) {
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'The E2E admin user exists but is not approved as an admin in user_profiles.',
    }
  }

  return { success: true }
}
