import { describe, expect, it, vi } from 'vitest'
import {
  clearConnection,
  forgetPassword,
  loadAddress,
  createConnectionSchema,
  loadConnection,
  resolveUrl,
  saveConnection,
} from '../lib/connection'

const storageKey = 'capibara-calendar-connection'
const nextcloud = {
  url: 'https://drive.example.org/remote.php/dav',
  username: 'ada',
  password: 'app-password',
}

describe('the connection', () => {
  it('is what was saved, with the address, the username and the password', () => {
    saveConnection(nextcloud)
    expect(loadConnection()).toEqual(nextcloud)
  })

  it('is none until a server is saved, and after it is forgotten', () => {
    localStorage.removeItem(storageKey) // the tests start connected
    expect(loadConnection()).toBeUndefined()
    saveConnection(nextcloud)
    clearConnection()
    expect(loadConnection()).toBeUndefined()
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('is none when what was stored is not a connection, or has no address that works', () => {
    for (const stored of [
      'not json',
      'null',
      '{"url":"","username":"","password":""}',
      '{"url":"ftp://files.example.org","username":"","password":""}',
      '{"username":"ada"}',
      '[]',
    ]) {
      localStorage.setItem(storageKey, stored)
      expect(loadConnection()).toBeUndefined()
    }
  })

  it('does not fail when the storage cannot be used', () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    const spies = [
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked),
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked),
    ]
    try {
      expect(loadConnection()).toBeUndefined()
      expect(() => {
        saveConnection(nextcloud)
      }).not.toThrow()
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })
})

describe('the address of a server', () => {
  it('is kept as it is when it is a whole address', () => {
    expect(resolveUrl('https://drive.example.org/remote.php/dav')).toBe(
      'https://drive.example.org/remote.php/dav',
    )
    expect(resolveUrl('  http://localhost:5232/  ')).toBe('http://localhost:5232/')
  })

  it('is on this site when it starts with a slash, where a proxy can take it to the server', () => {
    expect(resolveUrl('/remote.php/dav')).toBe(`${window.location.origin}/remote.php/dav`)
    expect(resolveUrl('/radicale/')).toBe(`${window.location.origin}/radicale/`)
  })

  it('is none when it is not an address of a web server', () => {
    expect(resolveUrl('ftp://files.example.org')).toBeUndefined()
    expect(resolveUrl('mailto:ada@example.org')).toBeUndefined()
    expect(resolveUrl('http://')).toBeUndefined()
  })
})

describe('the form of the connection', () => {
  const parse = (values: object) => createConnectionSchema().safeParse(values)

  it('needs an address that works, not a username or a password', () => {
    expect(parse({ url: 'https://x.example/dav', username: '', password: '' }).success).toBe(true)
    expect(parse({ url: '/remote.php/dav', username: 'ada', password: 'x' }).success).toBe(true)
    const none = parse({ url: '  ', username: 'ada', password: 'x' })
    expect(none.error?.issues[0].message).toBe('Enter the address of the server')
    const bad = parse({ url: 'ftp://x.example', username: '', password: '' })
    expect(bad.error?.issues[0].message).toBe('Enter a valid address')
  })

  it('trims the address and the username, and keeps the password as it was typed', () => {
    expect(parse({ url: ' /dav ', username: ' ada ', password: ' x ' }).data).toEqual({
      url: '/dav',
      username: 'ada',
      password: ' x ',
    })
  })

  it('keeps the password for the session only, and the address and the user for the next time', () => {
    saveConnection(nextcloud)

    expect(localStorage.getItem(storageKey)).not.toContain('app-password')
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '{}')).toEqual({
      url: nextcloud.url,
      username: nextcloud.username,
    })
    expect(localStorage.getItem('capibara-calendar-password')).toBe('app-password')
  })

  it('has the connection in the next session too, as the password is kept in the browser', () => {
    saveConnection(nextcloud)
    sessionStorage.clear() // the tab was closed

    expect(loadConnection()).toEqual(nextcloud)
  })

  it('forgets the password and keeps the address, when the password is not good any more', () => {
    saveConnection(nextcloud)

    forgetPassword()

    expect(loadConnection()).toBeUndefined()
    expect(loadAddress()?.url).toBe(nextcloud.url)
  })

  it('moves the password that an older version left with the address to a place of its own', () => {
    sessionStorage.clear()
    localStorage.setItem(storageKey, JSON.stringify(nextcloud))

    expect(loadConnection()).toEqual(nextcloud)
    expect(localStorage.getItem(storageKey)).not.toContain('app-password')
    expect(localStorage.getItem('capibara-calendar-password')).toBe('app-password')
  })
})
