import { expect, it, vi } from 'vitest'
import { HttpError } from '@/lib/errors'
import { isUnauthorized, notifyIfUnauthorized, setUnauthorizedHandler } from '@/lib/unauthorized'

it('is a password that the server does not accept: by the answer to the one that counts', () => {
  expect(isUnauthorized(new HttpError(401))).toBe(true)
  expect(
    isUnauthorized(new Error('Invalid credentials: PROPFIND https://x/dav returned 401')),
  ).toBe(true)
  expect(isUnauthorized(new Error('Collection query failed: 401 Unauthorized.'))).toBe(true)
})

it('is not any other problem: a server that is busy, a calendar that is gone, no network', () => {
  expect(isUnauthorized(new HttpError(403))).toBe(false)
  expect(isUnauthorized(new HttpError(404))).toBe(false)
  expect(isUnauthorized(new HttpError(503))).toBe(false)
  expect(isUnauthorized(new TypeError('Failed to fetch'))).toBe(false)
  expect(isUnauthorized(new Error('Collection query failed: 500 with a 401 in it'))).toBe(false)
})

it('tells the handler only for a password that is not accepted', () => {
  const handler = vi.fn()
  setUnauthorizedHandler(handler)
  try {
    notifyIfUnauthorized(new HttpError(503))
    expect(handler).not.toHaveBeenCalled()
    notifyIfUnauthorized(new HttpError(401))
    expect(handler).toHaveBeenCalledOnce()
  } finally {
    setUnauthorizedHandler(undefined)
  }
})
