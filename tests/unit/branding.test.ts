import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BRAND_PRIMARY_COLOR,
  buildTournamentBranding,
  isValidBrandPrimaryColor,
  normalizeBrandPrimaryColor,
  normalizePublicUrl,
} from '@/lib/branding'
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

describe('normalizeBrandPrimaryColor', () => {
  it('normalizes six-digit hex colours with or without a hash', () => {
    expect(normalizeBrandPrimaryColor(' F47C20 ')).toBe('#f47c20')
    expect(normalizeBrandPrimaryColor('#0F766E')).toBe('#0f766e')
  })

  it('rejects blank, short, and non-hex colours', () => {
    expect(normalizeBrandPrimaryColor('')).toBeNull()
    expect(normalizeBrandPrimaryColor('#fff')).toBeNull()
    expect(normalizeBrandPrimaryColor('tomato')).toBeNull()
  })

  it('supports boolean validation for form guards', () => {
    expect(isValidBrandPrimaryColor('#123abc')).toBe(true)
    expect(isValidBrandPrimaryColor('123abz')).toBe(false)
  })
})

describe('normalizePublicUrl', () => {
  it('keeps http and https URLs', () => {
    expect(normalizePublicUrl(' https://example.com/logo.png ')).toBe(
      'https://example.com/logo.png'
    )
    expect(normalizePublicUrl('http://localhost:3000/logo.png')).toBe(
      'http://localhost:3000/logo.png'
    )
  })

  it('rejects unsafe or malformed URLs', () => {
    expect(normalizePublicUrl('javascript:alert(1)')).toBeNull()
    expect(normalizePublicUrl('/relative/logo.png')).toBeNull()
    expect(normalizePublicUrl('not a url')).toBeNull()
  })
})

describe('buildTournamentBranding', () => {
  it('returns safe branding with fallbacks', () => {
    expect(
      buildTournamentBranding(
        tournament({
          logo_url: 'https://cdn.example.com/logo.png',
          brand_primary_color: '#008866',
          sponsor_name: 'Local Sponsor',
          sponsor_logo_url: 'https://cdn.example.com/sponsor.png',
          sponsor_url: 'https://sponsor.example.com',
        })
      )
    ).toEqual({
      logoUrl: 'https://cdn.example.com/logo.png',
      primaryColor: '#008866',
      hasCustomPrimaryColor: true,
      sponsorName: 'Local Sponsor',
      sponsorLogoUrl: 'https://cdn.example.com/sponsor.png',
      sponsorUrl: 'https://sponsor.example.com/',
      hasSponsor: true,
    })
  })

  it('ignores invalid stored values when rendering', () => {
    expect(
      buildTournamentBranding(
        tournament({
          logo_url: 'javascript:alert(1)',
          brand_primary_color: 'orange',
          sponsor_name: '   ',
          sponsor_logo_url: 'ftp://example.com/sponsor.png',
          sponsor_url: 'bad',
        })
      )
    ).toEqual({
      logoUrl: null,
      primaryColor: DEFAULT_BRAND_PRIMARY_COLOR,
      hasCustomPrimaryColor: false,
      sponsorName: null,
      sponsorLogoUrl: null,
      sponsorUrl: null,
      hasSponsor: false,
    })
  })
})
