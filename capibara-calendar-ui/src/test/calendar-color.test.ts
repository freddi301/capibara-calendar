import { describe, expect, it } from 'vitest'
import { calendarColors, normalizeColor, palette } from '../lib/calendar-color'

describe('the color that a server says', () => {
  it('is kept, in lower case', () => {
    expect(normalizeColor('#2563EB')).toBe('#2563eb')
    expect(normalizeColor('  #2563eb ')).toBe('#2563eb')
  })

  it('has no transparency, which the servers write at the end', () => {
    expect(normalizeColor('#FF2968FF')).toBe('#ff2968')
    expect(normalizeColor('#ff296880')).toBe('#ff2968')
  })

  it('is made of six digits when it is written with three', () => {
    expect(normalizeColor('#f80')).toBe('#ff8800')
  })

  it('is none when it is not a color that can be used', () => {
    for (const value of [
      'red',
      '#12',
      '#12345',
      '#1234567',
      '2563eb',
      '#gggggg',
      '',
      undefined,
      null,
      42,
    ]) {
      expect(normalizeColor(value)).toBeUndefined()
    }
  })
})

describe('the colors of the calendars', () => {
  it('are the ones that the server says', () => {
    const colors = calendarColors([
      { url: '/a/', color: '#FF0000FF' },
      { url: '/b/', color: '#00ff00' },
    ])
    expect(colors.get('/a/')).toBe('#ff0000')
    expect(colors.get('/b/')).toBe('#00ff00')
  })

  it('are the ones of the palette, one for each calendar, when the server has none', () => {
    const colors = calendarColors([{ url: '/a/' }, { url: '/b/' }, { url: '/c/', color: 'nope' }])
    expect([...colors.values()]).toEqual([palette[0], palette[1], palette[2]])
    expect(new Set(colors.values()).size).toBe(3)
  })

  it('are the one of the server for the calendars that have it, and the one of the place for the others', () => {
    const colors = calendarColors([{ url: '/a/', color: '#ff0000' }, { url: '/b/' }])
    expect(colors.get('/a/')).toBe('#ff0000')
    expect(colors.get('/b/')).toBe(palette[1])
  })

  it('start again from the first color when there are more calendars than colors', () => {
    const calendars = Array.from({ length: palette.length + 2 }, (_, index) => ({
      url: `/${index}/`,
    }))
    const colors = calendarColors(calendars)
    expect(colors.get(`/${palette.length}/`)).toBe(palette[0])
    expect(colors.get(`/${palette.length + 1}/`)).toBe(palette[1])
  })

  it('are the same every time', () => {
    const calendars = [{ url: '/a/' }, { url: '/b/' }]
    expect([...calendarColors(calendars)]).toEqual([...calendarColors(calendars)])
  })

  it('have twenty to choose from, all different, all colors that can be used', () => {
    expect(palette).toHaveLength(20)
    expect(new Set(palette).size).toBe(palette.length)
    for (const color of palette) expect(normalizeColor(color)).toBe(color)
  })

  it('are all different for twenty calendars', () => {
    const calendars = Array.from({ length: palette.length }, (_, index) => ({ url: `/${index}/` }))
    expect(new Set(calendarColors(calendars).values()).size).toBe(palette.length)
  })
})
