import { describe, expect, it } from 'vitest'
import {
  parsePhotonFeature,
  parsePhotonResponse,
  photonSearchUrl,
} from '@/lib/addressLookup'

describe('photonSearchUrl', () => {
  it('encodes the query and applies a limit', () => {
    expect(photonSearchUrl('Riverside Centre, Milton Keynes')).toBe(
      'https://photon.komoot.io/api/?q=Riverside%20Centre%2C%20Milton%20Keynes&limit=5'
    )
  })
})

describe('parsePhotonFeature', () => {
  it('parses a street address', () => {
    const parsed = parsePhotonFeature({
      properties: {
        housenumber: '12',
        street: 'High Street',
        city: 'Milton Keynes',
        county: 'Buckinghamshire',
        postcode: 'MK1 1AA',
        country: 'United Kingdom',
      },
    })
    expect(parsed.street).toBe('12 High Street')
    expect(parsed.line1).toBe('12 High Street')
    expect(parsed.city).toBe('Milton Keynes')
    expect(parsed.county).toBe('Buckinghamshire')
    expect(parsed.postcode).toBe('MK1 1AA')
    expect(parsed.country).toBe('United Kingdom')
    expect(parsed.label).toBe('12 High Street, Milton Keynes, MK1 1AA, United Kingdom')
  })

  it('keeps a named place separate from the street', () => {
    const parsed = parsePhotonFeature({
      properties: {
        name: 'Riverside Sports Centre',
        street: 'Mill Lane',
        city: 'Leeds',
        postcode: 'LS1 2AB',
        country: 'United Kingdom',
      },
    })
    expect(parsed.name).toBe('Riverside Sports Centre')
    expect(parsed.street).toBe('Mill Lane')
    expect(parsed.line1).toBe('Riverside Sports Centre, Mill Lane')
  })

  it('falls back to state when no county is present', () => {
    const parsed = parsePhotonFeature({
      properties: { street: 'Main St', city: 'Austin', state: 'Texas', country: 'United States' },
    })
    expect(parsed.county).toBe('Texas')
  })

  it('drops features that produce no usable label', () => {
    const entries = parsePhotonResponse({
      features: [{ properties: {} }, { properties: { city: 'Bristol' } }],
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].parsed.city).toBe('Bristol')
  })

  it('handles a non-object response safely', () => {
    expect(parsePhotonResponse(null)).toEqual([])
    expect(parsePhotonResponse({})).toEqual([])
  })
})
