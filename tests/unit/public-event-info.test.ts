import { describe, expect, it } from 'vitest'
import {
  buildContactRows,
  buildPublicInfoSections,
  hasPublicEventInfo,
  phoneHref,
  publicNotice,
} from '@/lib/publicEventInfo'
import type { Tournament } from '@/lib/types'

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    slug: 'qa-test',
    name: 'QA Test',
    start_date: null,
    end_date: null,
    status: 'upcoming',
    display_order: 0,
    courts: [],
    schedule_locked: false,
    schedule_mode: 'event_day',
    created_by: 'u1',
    ...overrides,
  }
}

describe('buildPublicInfoSections', () => {
  it('returns only populated sections, in display order', () => {
    const sections = buildPublicInfoSections(
      tournament({
        parking_notes: 'Use the overflow car park.',
        arrival_instructions: 'Check in at the desk.',
        facilities_notes: null,
        venue_notes: '   ',
      })
    )
    expect(sections.map((s) => s.key)).toEqual(['arrival', 'parking'])
    expect(sections[0]).toMatchObject({
      label: 'Getting there & arrival',
      text: 'Check in at the desk.',
    })
  })

  it('returns an empty array when nothing is set', () => {
    expect(buildPublicInfoSections(tournament())).toEqual([])
  })

  it('trims whitespace from section text', () => {
    const sections = buildPublicInfoSections(tournament({ venue_notes: '  Indoor courts.  ' }))
    expect(sections).toEqual([{ key: 'venue', label: 'Venue notes', text: 'Indoor courts.' }])
  })
})

describe('buildContactRows', () => {
  it('builds rows with mailto and tel links', () => {
    const rows = buildContactRows(
      tournament({
        organiser_contact_name: 'Sam Organiser',
        organiser_contact_email: 'sam@example.com',
        organiser_contact_phone: '07700 900123',
        emergency_contact: 'First aid desk',
      })
    )
    expect(rows).toEqual([
      { key: 'name', label: 'Organiser', value: 'Sam Organiser', href: null },
      { key: 'email', label: 'Email', value: 'sam@example.com', href: 'mailto:sam@example.com' },
      { key: 'phone', label: 'Phone', value: '07700 900123', href: 'tel:07700900123' },
      { key: 'emergency', label: 'Emergency contact', value: 'First aid desk', href: null },
    ])
  })

  it('handles any subset of contact fields being missing', () => {
    const rows = buildContactRows(tournament({ organiser_contact_phone: '+44 7700 900123' }))
    expect(rows).toEqual([
      { key: 'phone', label: 'Phone', value: '+44 7700 900123', href: 'tel:+447700900123' },
    ])
  })

  it('returns no rows when all contact fields are blank', () => {
    expect(buildContactRows(tournament({ organiser_contact_name: '  ' }))).toEqual([])
  })
})

describe('phoneHref', () => {
  it('strips spaces, dashes, and parentheses but keeps a leading plus', () => {
    expect(phoneHref('+44 (0)7700 900-123')).toBe('tel:+4407700900123')
  })
})

describe('publicNotice', () => {
  it('returns trimmed notice text', () => {
    expect(publicNotice(tournament({ public_notice: ' Finals moved to Court 2. ' }))).toBe(
      'Finals moved to Court 2.'
    )
  })

  it('returns null for blank or missing notices', () => {
    expect(publicNotice(tournament())).toBeNull()
    expect(publicNotice(tournament({ public_notice: '   ' }))).toBeNull()
  })
})

describe('hasPublicEventInfo', () => {
  it('is false for a tournament with no event info', () => {
    expect(hasPublicEventInfo(tournament())).toBe(false)
  })

  it('is true when any section or contact field is set', () => {
    expect(hasPublicEventInfo(tournament({ parking_notes: 'Car park B' }))).toBe(true)
    expect(hasPublicEventInfo(tournament({ organiser_contact_email: 'a@b.com' }))).toBe(true)
  })
})
