import { t } from '@lingui/core/macro'
import { ApiError } from '@/api/calendar-api'

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
  if (isUnreachable(error)) {
    return t`Cannot reach the CalDAV server`
  }
  return t`Could not connect to the server.`
}

export function calendarErrorMessage(error: unknown, action: 'save' | 'delete') {
  const kind = kindOf(error)
  if (kind === 'notFound') return t`This calendar is not on the server any more.`
  if (kind === 'forbidden' || kind === 'unauthorized') return t`The server did not allow this.`
  if (isUnreachable(error)) return t`Cannot reach the CalDAV server`
  return action === 'save'
    ? t`The calendar could not be saved.`
    : t`The calendar could not be deleted.`
}

function kindOf(error: unknown) {
  if (error instanceof ApiError) return error.kind
  if (error instanceof HttpError) {
    if (error.status === 404) return 'notFound'
    if (error.status === 412) return 'conflict'
    if (error.status === 401) return 'unauthorized'
    if ([403, 405, 409].includes(error.status)) return 'forbidden'
  }
  return undefined
}

const isUnreachable = (error: unknown) =>
  error instanceof TypeError || (error instanceof ApiError && error.kind === 'unreachable')

export function isConflict(error: unknown) {
  return kindOf(error) === 'conflict'
}

export function conflictOf(saveError: unknown, deleteError: unknown) {
  if (isConflict(saveError)) return 'save'
  return isConflict(deleteError) ? 'delete' : undefined
}

export function isRetryable(error: unknown) {
  const kind = kindOf(error)
  return !(
    kind === 'unauthorized' ||
    kind === 'forbidden' ||
    kind === 'notFound' ||
    kind === 'conflict'
  )
}

export function errorMessage(error: unknown, action: 'save' | 'delete' | 'load' = 'load') {
  const kind = kindOf(error)
  if (kind === 'conflict') {
    return t`This event was changed on the server after you opened it. Go back and open it again.`
  }
  if (kind === 'notFound') return t`This event is not on the server any more.`
  if (kind === 'unauthorized' || kind === 'forbidden') return t`The server did not allow this.`
  if (isUnreachable(error)) return t`Cannot reach the CalDAV server`
  if (action === 'save') return t`The event could not be saved.`
  if (action === 'delete') return t`The event could not be deleted.`
  return t`Something went wrong.`
}
