import { describe, expect, it } from 'vitest'
import { formatCoordinates, geoLink, parseCoordinates } from '@/lib/coordinates'

describe('reading the coordinates that a person typed', () => {
  it('takes latitude and longitude separated by a comma, a semicolon or a space', () => {
    // given
    const expected = { latitude: 44.38, longitude: 9.04 }

    const typed = ['44.38, 9.04', '44.38,9.04', '44.38; 9.04', '44.38 9.04', '  44.38   9.04 ']

    // when
    const read = typed.map((text) => parseCoordinates(text))

    // then
    for (const one of read) expect(one).toEqual(expected)
  })

  it('takes negative values and whole numbers', () => {
    // given
    const typed = ['-33.8688, 151.2093', '45, -90']

    // when
    const [south, whole] = typed.map(parseCoordinates)

    // then
    expect(south).toEqual({ latitude: -33.8688, longitude: 151.2093 })
    expect(whole).toEqual({ latitude: 45, longitude: -90 })
  })

  it('does not take what is not two numbers, or a place that is not on Earth', () => {
    // given
    const refused = ['', 'abc', '44.38', '44.38,', '44.38, 9.04, 12', '91, 0', '0, 181', '-91, 0']

    // when
    const read = refused.map((text) => parseCoordinates(text))

    // then
    expect(read.every((one) => one === undefined)).toBe(true)
  })
})

describe('writing the coordinates', () => {
  it('keeps six decimals at most, and no zeros at the end', () => {
    // given
    const coordinates = { latitude: 44.382217630379, longitude: 9.0 }

    // when
    const text = formatCoordinates(coordinates)
    const link = geoLink(coordinates)

    // then
    expect(text).toBe('44.382218, 9')
    expect(link).toBe('geo:44.382218,9')
  })

  it('makes a geo: link, that the device opens with the maps app that the person prefers', () => {
    // given
    const sydney = { latitude: -33.8688, longitude: 151.2093 }

    // when
    const link = geoLink(sydney)

    // then
    expect(link).toBe('geo:-33.8688,151.2093')
  })
})
