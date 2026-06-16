// Pure helpers for the public event info fields on tournaments
// (added by add_public_event_info.sql). Keeps the hub rendering dumb and
// the filtering/link-building logic unit-testable.

import type { Tournament } from '@/lib/types'

export interface PublicInfoSection {
  /** Stable key for React lists and tests. */
  key: string
  label: string
  text: string
}

export interface ContactRow {
  key: string
  label: string
  value: string
  /** mailto:/tel: link, or null for plain text rows. */
  href: string | null
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * The populated event-info sections for the public Info tab, in display
 * order. Blank/whitespace-only fields are omitted entirely.
 */
export function buildPublicInfoSections(tournament: Tournament): PublicInfoSection[] {
  const candidates: Array<[key: string, label: string, value: string | null | undefined]> = [
    ['arrival', 'Getting there & arrival', tournament.arrival_instructions],
    ['parking', 'Parking', tournament.parking_notes],
    ['venue', 'Venue notes', tournament.venue_notes],
    ['facilities', 'Facilities', tournament.facilities_notes],
  ]
  const sections: PublicInfoSection[] = []
  for (const [key, label, value] of candidates) {
    const text = clean(value)
    if (text) sections.push({ key, label, text })
  }
  return sections
}

/** tel: href for a phone number — digits and a leading + only. */
export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}

/**
 * Organiser/emergency contact rows for the public Info tab. Handles any
 * subset of name/email/phone being missing; returns [] when nothing is set.
 */
export function buildContactRows(tournament: Tournament): ContactRow[] {
  const rows: ContactRow[] = []
  const name = clean(tournament.organiser_contact_name)
  const email = clean(tournament.organiser_contact_email)
  const phone = clean(tournament.organiser_contact_phone)
  const emergency = clean(tournament.emergency_contact)

  if (name) rows.push({ key: 'name', label: 'Organiser', value: name, href: null })
  if (email) rows.push({ key: 'email', label: 'Email', value: email, href: `mailto:${email}` })
  if (phone) rows.push({ key: 'phone', label: 'Phone', value: phone, href: phoneHref(phone) })
  if (emergency) rows.push({ key: 'emergency', label: 'Emergency contact', value: emergency, href: null })

  return rows
}

/** The public notice text, or null when blank — shown as a hub-wide banner. */
export function publicNotice(tournament: Tournament): string | null {
  return clean(tournament.public_notice)
}

/** True when the tournament has any public event info to show on the Info tab. */
export function hasPublicEventInfo(tournament: Tournament): boolean {
  return buildPublicInfoSections(tournament).length > 0 || buildContactRows(tournament).length > 0
}
