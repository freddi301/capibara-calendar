import { t } from '@lingui/core/macro'

export class HttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

export function connectionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('Invalid credentials')) return t`Wrong username or password.`
  if (message.startsWith('cannot find principalUrl')) {
    return t`This does not look like the address of a CalDAV server.`
  }
  if (error instanceof TypeError) {
    return t`Cannot reach the CalDAV server`
  }
  return t`Could not connect to the server.`
}

export function calendarErrorMessage(error: unknown, action: 'save' | 'delete') {
  if (error instanceof HttpError) {
    if (error.status === 404) return t`This calendar is not on the server any more.`
    if ([401, 403, 405, 409].includes(error.status)) return t`The server did not allow this.`
  } else if (error instanceof TypeError) {
    return t`Cannot reach the CalDAV server`
  }
  return action === 'save'
    ? t`The calendar could not be saved.`
    : t`The calendar could not be deleted.`
}

export function isConflict(error: unknown) {
  return error instanceof HttpError && error.status === 412
}

export function conflictOf(saveError: unknown, deleteError: unknown) {
  if (isConflict(saveError)) return 'save'
  return isConflict(deleteError) ? 'delete' : undefined
}

export function isNotFound(error: unknown) {
  if (error instanceof HttpError) return error.status === 404
  return error instanceof Error && /^Collection query failed: 404\b/.test(error.message)
}

export function isRetryable(error: unknown) {
  return !(error instanceof HttpError && [401, 403, 404, 405, 409, 412].includes(error.status))
}

export function errorMessage(error: unknown, action: 'save' | 'delete' | 'load' = 'load') {
  if (error instanceof HttpError) {
    if (error.status === 412) {
      return t`This event was changed on the server after you opened it. Go back and open it again.`
    }
    if (error.status === 404) return t`This event is not on the server any more.`
    if (error.status === 401 || error.status === 403) return t`The server did not allow this.`
  } else if (error instanceof TypeError) {
    return t`Cannot reach the CalDAV server`
  }
  if (action === 'save') return t`The event could not be saved.`
  if (action === 'delete') return t`The event could not be deleted.`
  return t`Something went wrong.`
}
