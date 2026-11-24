import { describe, expect, it } from 'vitest'
import { duoUrl, records, RESOURCES, samenvatting } from './duo-ophalen.mjs'

describe('duoUrl', () => {
  it('zet resource, filters en velden in de querystring', () => {
    const url = new URL(duoUrl(RESOURCES.tellingen, { INSTELLINGSCODE: ['21NK'], PEILJAAR: [2025] }))
    expect(url.origin + url.pathname).toBe('https://onderwijsdata.duo.nl/api/3/action/datastore_search')
    expect(url.searchParams.get('resource_id')).toBe(RESOURCES.tellingen)
    expect(JSON.parse(url.searchParams.get('filters'))).toEqual({ INSTELLINGSCODE: ['21NK'], PEILJAAR: [2025] })
    expect(url.searchParams.has('fields')).toBe(false)
    expect(new URL(duoUrl('x', {}, 'A,B')).searchParams.get('fields')).toBe('A,B')
  })
})

describe('records', () => {
  it('geeft de records van een geslaagd antwoord', () => {
    expect(records({ success: true, result: { records: [{ a: 1 }], total: 1 } })).toEqual([{ a: 1 }])
  })

  it('weigert een mislukt, leeg of onvolledig antwoord', () => {
    expect(() => records({ success: false })).toThrow('weigerde')
    expect(() => records({ success: true, result: {} })).toThrow('geen records')
    expect(() => records({ success: true, result: { records: [], total: 5 } })).toThrow('meer rijen')
  })
})

describe('samenvatting', () => {
  it('vat een ronde samen', () => {
    expect(samenvatting({ gelukt: true, tellingen: 96, vestigingen: 968, ingevuld: 3 })).toBe(
      '96 tellingen en 968 vestigingen opgehaald; 3 aantallen ingevuld of bijgewerkt.',
    )
    expect(samenvatting({ gelukt: false, melding: 'DUO gaf geen vestigingen terug' })).toBe(
      'Mislukt: DUO gaf geen vestigingen terug',
    )
  })
})
