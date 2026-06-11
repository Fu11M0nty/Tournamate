// Free, global address autocomplete via Photon (https://photon.komoot.io),
// an OpenStreetMap-based geocoder. No API key, no cost. The public instance is
// best-effort, so lookup is always a convenience layered over manual entry.
//
// OSM data is ODbL-licensed — show "© OpenStreetMap contributors" attribution
// anywhere results are displayed.

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/'

export interface PhotonProperties {
  name?: string
  housenumber?: string
  street?: string
  postcode?: string
  city?: string
  district?: string
  locality?: string
  county?: string
  state?: string
  country?: string
  countrycode?: string
  type?: string
}

export interface PhotonFeature {
  properties?: PhotonProperties
  geometry?: { coordinates?: [number, number] }
}

export interface ParsedAddress {
  /** A named place / point of interest (e.g. "Riverside Sports Centre"). */
  name: string
  /** Street line, e.g. "12 High Street". */
  street: string
  /** Combined first address line (name + street). */
  line1: string
  city: string
  county: string
  postcode: string
  country: string
  /** Human-readable single-line summary for the suggestion list. */
  label: string
}

export function photonSearchUrl(query: string, limit = 5): string {
  return `${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}&limit=${limit}`
}

export function parsePhotonFeature(feature: PhotonFeature): ParsedAddress {
  const p = feature.properties ?? {}
  const street = [p.housenumber, p.street].filter(Boolean).join(' ').trim()
  const city = p.city || p.district || p.locality || ''
  const name = p.name && p.name !== street && p.name !== city ? p.name : ''
  const county = p.county || p.state || ''
  const postcode = p.postcode || ''
  const country = p.country || ''
  const line1 = [name, street].filter(Boolean).join(', ') || name || street
  const label = Array.from(
    new Set([name, street, city, postcode, country].filter(Boolean))
  ).join(', ')

  return { name, street, line1, city, county, postcode, country, label }
}

export function parsePhotonResponse(data: unknown): { feature: PhotonFeature; parsed: ParsedAddress }[] {
  const features =
    data && typeof data === 'object' && Array.isArray((data as { features?: unknown }).features)
      ? ((data as { features: PhotonFeature[] }).features)
      : []
  return features
    .map((feature) => ({ feature, parsed: parsePhotonFeature(feature) }))
    .filter((entry) => entry.parsed.label.length > 0)
}
