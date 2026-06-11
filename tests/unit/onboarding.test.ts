import { describe, expect, it } from 'vitest'
import {
  normalizeEmail,
  isValidEmail,
  isValidRole,
  mapOnboardingStatus,
} from '@/lib/userOnboarding'

describe('normalizeEmail', () => {
  it('trims surrounding whitespace and lower-cases', () => {
    expect(normalizeEmail('  Organiser@Club.CO.UK ')).toBe('organiser@club.co.uk')
  })

  it('leaves an already-normalized address unchanged', () => {
    expect(normalizeEmail('a@b.com')).toBe('a@b.com')
  })
})

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('organiser@club.co.uk')).toBe(true)
    expect(isValidEmail('a.b-c@example.org')).toBe(true)
  })

  it('rejects empties, spaces and malformed addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('no-at-sign')).toBe(false)
    expect(isValidEmail('two@@at.com')).toBe(false)
    expect(isValidEmail('trailing@dot.')).toBe(false)
    expect(isValidEmail('has space@club.com')).toBe(false)
    expect(isValidEmail('missing@tld')).toBe(false)
  })
})

describe('isValidRole', () => {
  it('only accepts the two known roles', () => {
    expect(isValidRole('superadmin')).toBe(true)
    expect(isValidRole('tournament_admin')).toBe(true)
    expect(isValidRole('owner')).toBe(false)
    expect(isValidRole('')).toBe(false)
  })
})

describe('mapOnboardingStatus', () => {
  it('flags unapproved users as pending regardless of sign-in', () => {
    expect(
      mapOnboardingStatus({ is_approved: false, last_sign_in_at: '2026-06-01T00:00:00Z' }),
    ).toEqual({ label: 'Pending approval', tone: 'amber' })
  })

  it('shows approved-but-never-signed-in as invited', () => {
    expect(
      mapOnboardingStatus({ is_approved: true, last_sign_in_at: null, email_confirmed_at: null }),
    ).toEqual({ label: 'Invited', tone: 'amber' })
  })

  it('shows approved users who have signed in as active', () => {
    expect(
      mapOnboardingStatus({ is_approved: true, last_sign_in_at: '2026-06-02T10:00:00Z' }),
    ).toEqual({ label: 'Active', tone: 'green' })
  })
})
