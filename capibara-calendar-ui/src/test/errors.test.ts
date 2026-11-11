import { describe, expect, it } from 'vitest'
import { connectionErrorMessage, errorMessage, HttpError, isRetryable } from '../lib/errors'

describe('error messages', () => {
  it('say that the server cannot be reached, whatever was being done', () => {
    for (const action of ['save', 'delete', 'load'] as const) {
      expect(errorMessage(new TypeError('Failed to fetch'), action)).toBe(
        'Cannot reach the CalDAV server',
      )
    }
  })

  it('say what the server answered, when that says what is wrong', () => {
    expect(errorMessage(new HttpError(412), 'save')).toMatch(/changed on the server/)
    expect(errorMessage(new HttpError(404), 'delete')).toBe(
      'This event is not on the server any more.',
    )
    expect(errorMessage(new HttpError(401))).toBe('The server did not allow this.')
    expect(errorMessage(new HttpError(403), 'save')).toBe('The server did not allow this.')
  })

  it('say what could not be done, for the rest', () => {
    expect(errorMessage(new HttpError(500), 'save')).toBe('The event could not be saved.')
    expect(errorMessage(new Error('?'), 'delete')).toBe('The event could not be deleted.')
    expect(errorMessage(new HttpError(503))).toBe('Something went wrong.')
  })

  it('know the status of an answer of the server', () => {
    expect(new HttpError(412).status).toBe(412)
    expect(new HttpError(412)).toBeInstanceOf(Error)
  })
})

describe('trying again', () => {
  it('can work when the server was not reached or was busy', () => {
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true)
    expect(isRetryable(new HttpError(500))).toBe(true)
    expect(isRetryable(new HttpError(503))).toBe(true)
  })

  it('cannot work when the server said no', () => {
    for (const status of [401, 403, 404, 412])
      expect(isRetryable(new HttpError(status))).toBe(false)
  })
})

describe('connection error messages', () => {
  it('say that the username or the password is not right', () => {
    expect(
      connectionErrorMessage(new Error('Invalid credentials: PROPFIND https://x/dav returned 401')),
    ).toBe('Wrong username or password.')
  })

  it('say that the address is not one of a CalDAV server', () => {
    expect(connectionErrorMessage(new Error('cannot find principalUrl'))).toBe(
      'This does not look like the address of a CalDAV server.',
    )
  })

  it('say that the server was not reached', () => {
    expect(connectionErrorMessage(new TypeError('Failed to fetch'))).toBe(
      'Cannot reach the CalDAV server',
    )
  })

  it('say that it could not be done, for the rest', () => {
    expect(connectionErrorMessage(new Error('?'))).toBe('Could not connect to the server.')
    expect(connectionErrorMessage('nothing')).toBe('Could not connect to the server.')
  })
})
