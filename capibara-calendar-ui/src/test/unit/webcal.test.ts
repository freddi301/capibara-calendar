// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { seedStored, storedJson } from '@/test/support/stored'
import { addWebcal, changeWebcal, createWebcalSchema, nameOfFeed, removeWebcal } from '@/lib/webcal'

describe('the name of a webcal that nobody named', () => {
  it('is its address without the protocol', () => {
    // then
    expect(nameOfFeed('https://eventi.sinistraverso.org/feed/ics')).toBe(
      'eventi.sinistraverso.org/feed/ics',
    )
    expect(nameOfFeed('webcal://feeds.example/a.ics')).toBe('feeds.example/a.ics')
    expect(nameOfFeed('  http://feeds.example/a.ics ')).toBe('feeds.example/a.ics')
  })

  it('is what was written when there is no protocol', () => {
    // then
    expect(nameOfFeed('feeds.example/a.ics')).toBe('feeds.example/a.ics')
    expect(nameOfFeed('')).toBe('')
  })
})

describe('the webcals that are kept', () => {
  it('are added with their address, name and color, and each has its own id', () => {
    // when
    const first = addWebcal({ url: 'https://feeds.example/a.ics', name: 'A', color: '#2563eb' })
    const second = addWebcal({ url: 'https://feeds.example/b.ics', name: 'B' })

    // then
    expect(first).not.toBe(second)
    expect(storedJson().webcals).toEqual({
      [first]: { url: 'https://feeds.example/a.ics', name: 'A', color: '#2563eb' },
      [second]: { url: 'https://feeds.example/b.ics', name: 'B' },
    })
  })

  it('change their name and color, and only those of the one that is changed', () => {
    // given
    const first = addWebcal({ url: 'https://feeds.example/a.ics', name: 'A' })
    const second = addWebcal({ url: 'https://feeds.example/b.ics', name: 'B' })

    // when
    changeWebcal(first, { name: 'Holidays', color: '#dc2626' })

    // then
    expect(storedJson().webcals).toEqual({
      [first]: { url: 'https://feeds.example/a.ics', name: 'Holidays', color: '#dc2626' },
      [second]: { url: 'https://feeds.example/b.ics', name: 'B' },
    })
  })

  it('are removed one at a time', () => {
    // given
    const first = addWebcal({ url: 'https://feeds.example/a.ics', name: 'A' })
    const second = addWebcal({ url: 'https://feeds.example/b.ics', name: 'B' })

    // when
    removeWebcal(first)

    // then
    expect(Object.keys(storedJson().webcals as object)).toEqual([second])
  })

  it('are not changed when the one that is changed is not there', () => {
    // given
    seedStored({ webcals: {} })

    // when
    changeWebcal('nowhere', { name: 'Holidays' })

    // then
    expect(storedJson().webcals).toEqual({})
  })
})

describe('the address to add', () => {
  const messageOf = (url: string) => {
    const result = createWebcalSchema().safeParse({ url, name: '' })
    return result.success ? undefined : result.error.issues[0].message
  }

  it('is needed, and has to be an address on the network', () => {
    // then
    expect(messageOf('')).toBe('Enter the address of the Webcal')
    expect(messageOf('ftp://feeds.example/a.ics')).toBe('Enter a valid address')
    expect(messageOf('not an address')).toBe('Enter a valid address')
    expect(messageOf('webcal://feeds.example/a.ics')).toBeUndefined()
  })

  it('is refused when the same webcal is there, written another way', () => {
    // given
    addWebcal({ url: 'https://feeds.example/a.ics', name: 'A' })

    // then
    expect(messageOf('https://feeds.example/a.ics')).toBe('This Webcal is already added')
    expect(messageOf('webcal://feeds.example/a.ics')).toBe('This Webcal is already added')
    expect(messageOf('  WEBCAL://FEEDS.example/a.ics ')).toBe('This Webcal is already added')
  })

  it('is accepted when it is another path of the same site', () => {
    // given
    addWebcal({ url: 'https://feeds.example/a.ics', name: 'A' })

    // then
    expect(messageOf('https://feeds.example/b.ics')).toBeUndefined()
    expect(messageOf('https://feeds.example/a.ics/')).toBeUndefined()
  })
})
