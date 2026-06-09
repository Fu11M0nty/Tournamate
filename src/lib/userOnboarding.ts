import type { UserRole } from './types'

/**
 * Pure helpers for the organiser onboarding flow. Kept free of Supabase/React
 * imports so they can be unit-tested in isolation.
 */

/** Trim surrounding whitespace and lower-case an email for consistent storage/lookup. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Lightweight email shape check — not RFC-complete, just enough to catch obvious
 * typos before we hand the address to Supabase. Expects a normalized input.
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false
  if (/\s/.test(email)) return false
  return /^[^@]+@[^@.]+(\.[^@.]+)+$/.test(email)
}

/** The two roles the product recognises. */
export function isValidRole(role: string): role is UserRole {
  return role === 'superadmin' || role === 'tournament_admin'
}

export type OnboardingTone = 'green' | 'amber' | 'zinc'

export interface OnboardingStatusInput {
  is_approved: boolean
  email_confirmed_at?: string | null
  last_sign_in_at?: string | null
}

export interface OnboardingStatus {
  label: string
  tone: OnboardingTone
}

/**
 * Derives a human-readable onboarding status for a user row, purely from the
 * approval flag and the auth timestamps:
 *  - not approved            → "Pending approval" (amber)
 *  - approved, never signed in → "Invited" (amber)  (link sent, not yet used)
 *  - approved, has signed in → "Active" (green)
 */
export function mapOnboardingStatus(user: OnboardingStatusInput): OnboardingStatus {
  if (!user.is_approved) {
    return { label: 'Pending approval', tone: 'amber' }
  }
  if (!user.last_sign_in_at) {
    return { label: 'Invited', tone: 'amber' }
  }
  return { label: 'Active', tone: 'green' }
}
