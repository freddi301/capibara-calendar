import { ApiError } from '@/api/calendar-api'
import { HttpError } from './errors'

let handler: ((sourceId?: string) => void) | undefined

export function setUnauthorizedHandler(onUnauthorized: ((sourceId?: string) => void) | undefined) {
  handler = onUnauthorized
}

export function isUnauthorized(error: unknown) {
  if (error instanceof ApiError) return error.kind === 'unauthorized'
  if (error instanceof HttpError) return error.status === 401
  return (
    error instanceof Error &&
    /^(Invalid credentials|Collection query failed: 401)/.test(error.message)
  )
}

export function notifyIfUnauthorized(error: unknown) {
  if (isUnauthorized(error)) handler?.(error instanceof ApiError ? error.sourceId : undefined)
}
