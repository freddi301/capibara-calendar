import { describe, expect, it } from 'vitest'
import { matchesZone, zoneGroups, zoneOption } from '../lib/zone-choice'

const zones = [
  'UTC',
  'Europe/Rome',
  'Europe/Paris',
  'America/New_York',
  'America/Argentina/Buenos_Aires',
  'Zulu',
]
const values = (group: { items: { value: string }[] }) => group.items.map(({ value }) => value)

describe('the groups of the time zone select', () => {
  it('start with the pinned options once each, and leave them out of the others', () => {
    const pinned = [
      zoneOption('Europe/Rome'),
      zoneOption('UTC', { hint: 'Universal' }),
      zoneOption('UTC'),
      zoneOption('floating', { label: 'Floating' }),
    ]

    const [first, ...others] = zoneGroups(pinned, zones, 'Other')

    expect(values(first)).toEqual(['Europe/Rome', 'UTC', 'floating'])
    expect(first.items[1].hint).toBe('Universal')
    expect(others.flatMap(values)).not.toContain('Europe/Rome')
    expect(others.flatMap(values)).not.toContain('UTC')
  })

  it('go by the prefix, in order, and the ones without a prefix are in the last one', () => {
    const [, ...others] = zoneGroups([], zones, 'Other')

    expect(others.map(({ value }) => value)).toEqual(['America', 'Europe', 'Other'])
    const america = others[0].items
    expect(america.map(({ label }) => label)).toEqual(['Argentina/Buenos Aires', 'New York'])
    expect(america[0].title).toBe('America/Argentina/Buenos_Aires')
  })
})

describe('the search of the time zone select', () => {
  const found = (query: string) =>
    zones.map((zone) => zoneOption(zone)).filter((option) => matchesZone(option, query))

  it('does not mind capitals, spaces around, or the underscore being a space', () => {
    expect(found('  ROME ').map(({ value }) => value)).toEqual(['Europe/Rome'])
    expect(found('new york').map(({ value }) => value)).toEqual(['America/New_York'])
    expect(found('europe/pa').map(({ value }) => value)).toEqual(['Europe/Paris'])
  })

  it('does not mind accents, and finds the words of the hint', () => {
    const utc = zoneOption('UTC', { hint: 'Ora universale, senza ora legale' })
    expect(matchesZone(utc, 'unìversale')).toBe(true)
    expect(matchesZone(utc, 'tokyo')).toBe(false)
  })
})
