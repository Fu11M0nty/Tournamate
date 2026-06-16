import type { Tournament } from '@/lib/types'

export const DEFAULT_BRAND_PRIMARY_COLOR = '#f47c20'
export const TOURNAMENT_BRANDING_BUCKET = 'tournament-branding'
export const MAX_BRANDING_IMAGE_BYTES = 2 * 1024 * 1024

export interface TournamentBranding {
  logoUrl: string | null
  primaryColor: string
  hasCustomPrimaryColor: boolean
  sponsorName: string | null
  sponsorLogoUrl: string | null
  sponsorUrl: string | null
  hasSponsor: boolean
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function normalizeBrandPrimaryColor(
  value: string | null | undefined
): string | null {
  const trimmed = clean(value)
  if (!trimmed) return null
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : null
}

export function isValidBrandPrimaryColor(value: string): boolean {
  return normalizeBrandPrimaryColor(value) !== null
}

export function normalizePublicUrl(value: string | null | undefined): string | null {
  const trimmed = clean(value)
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function buildTournamentBranding(tournament: Tournament): TournamentBranding {
  const logoUrl = normalizePublicUrl(tournament.logo_url)
  const primaryColor = normalizeBrandPrimaryColor(tournament.brand_primary_color)
  const sponsorName = clean(tournament.sponsor_name)
  const sponsorLogoUrl = normalizePublicUrl(tournament.sponsor_logo_url)
  const sponsorUrl = normalizePublicUrl(tournament.sponsor_url)
  const hasSponsor = Boolean(sponsorName || sponsorLogoUrl)

  return {
    logoUrl,
    primaryColor: primaryColor ?? DEFAULT_BRAND_PRIMARY_COLOR,
    hasCustomPrimaryColor: primaryColor !== null,
    sponsorName,
    sponsorLogoUrl,
    sponsorUrl,
    hasSponsor,
  }
}
