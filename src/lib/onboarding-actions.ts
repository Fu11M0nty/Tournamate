'use server'

import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from './supabase'
import { normalizeEmail, isValidEmail } from './userOnboarding'

export interface InviteOrganiserResult {
  success: boolean
  error?: string
  /** The copyable invite / set-password action link to send to the organiser. */
  actionLink?: string
  email?: string
  /** True when the email already had an account (we approved + sent a reset link). */
  alreadyExisted?: boolean
}

/**
 * Resolve the public origin (protocol + host) of the current request so the
 * invite link redirects back to this deployment. Falls back to NEXT_PUBLIC_SITE_URL.
 */
async function resolveOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (host) {
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

/**
 * Invite (or approve) a tournament organiser. Superadmin-only.
 *
 * Creates the auth user via the Supabase service-role admin API, marks their
 * profile as an approved tournament_admin, and returns a copyable invite /
 * set-password link to hand to the organiser (the concierge pilot flow — no
 * SMTP dependency). The service-role key never leaves the server.
 *
 * Falls back to a recovery (password-reset) link + approval if the email is
 * already registered.
 */
export async function inviteOrganiser(emailRaw: string): Promise<InviteOrganiserResult> {
  // 1. Authenticate + authorize the caller as an approved superadmin.
  const cookieClient = await createServerSupabaseClient()
  const {
    data: { user: caller },
  } = await cookieClient.auth.getUser()
  if (!caller) {
    return { success: false, error: 'You must be signed in.' }
  }
  const { data: callerProfile } = await cookieClient
    .from('user_profiles')
    .select('role, is_approved')
    .eq('id', caller.id)
    .single()
  if (callerProfile?.role !== 'superadmin' || callerProfile?.is_approved !== true) {
    return { success: false, error: 'Only superadmins can invite organisers.' }
  }

  // 2. Validate the email.
  const email = normalizeEmail(emailRaw ?? '')
  if (!isValidEmail(email)) {
    return { success: false, error: 'Enter a valid email address.' }
  }

  // 3. Service-role client — server-only. Guard against a missing key.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) {
    return {
      success: false,
      error:
        'Server is missing SUPABASE_SERVICE_ROLE_KEY — invite the organiser manually via the Supabase dashboard (see supabase/README.md).',
    }
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const origin = await resolveOrigin()
  const redirectTo = `${origin}/auth/set-password`

  // 4. Try to invite as a brand-new user; fall back to a recovery link if they exist.
  let actionLink: string | undefined
  let userId: string | undefined
  let alreadyExisted = false

  const invite = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  })

  if (invite.error) {
    const message = invite.error.message?.toLowerCase() ?? ''
    const isExisting =
      message.includes('already') || message.includes('registered') || message.includes('exists')
    if (!isExisting) {
      return { success: false, error: `Could not create invite: ${invite.error.message}` }
    }
    alreadyExisted = true
    const recovery = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })
    if (recovery.error || !recovery.data?.user) {
      return {
        success: false,
        error: `That email is already registered, and a reset link could not be generated: ${
          recovery.error?.message ?? 'unknown error'
        }`,
      }
    }
    actionLink = recovery.data.properties?.action_link
    userId = recovery.data.user.id
  } else {
    actionLink = invite.data.properties?.action_link
    userId = invite.data.user?.id
  }

  if (!userId) {
    return { success: false, error: 'Invite succeeded but no user id was returned.' }
  }

  // 5. Ensure the profile is an approved tournament_admin (never downgrade a superadmin).
  const { data: existing } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  const role = existing?.role === 'superadmin' ? 'superadmin' : 'tournament_admin'

  const { error: profileError } = await admin
    .from('user_profiles')
    .upsert({ id: userId, role, is_approved: true }, { onConflict: 'id' })
  if (profileError) {
    return { success: false, error: `Account created but approval failed: ${profileError.message}` }
  }

  return { success: true, actionLink, email, alreadyExisted }
}
