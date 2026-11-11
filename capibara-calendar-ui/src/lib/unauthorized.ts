import { HttpError } from './errors'

let handler: (() => void) | undefined

export function setUnauthorizedHandler(onUnauthorized: (() => void) | undefined) {
  handler = onUnauthorized
}

export function isUnauthorized(error: unknown) {
  if (error instanceof HttpError) return error.status === 401
  return (
    error instanceof Error &&
    /^(Invalid credentials|Collection query failed: 401)/.test(error.message)
  )
}

export function notifyIfUnauthorized(error: unknown) {
  if (isUnauthorized(error)) handler?.()
}
