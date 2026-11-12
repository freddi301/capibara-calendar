import { HttpError } from '../../lib/errors'
import { ApiError, type SourceId } from '../calendar-api'

export function toApiError(error: unknown, sourceId?: SourceId): ApiError {
  if (error instanceof ApiError) return error
  const message = error instanceof Error ? error.message : ''
  const status = error instanceof HttpError ? error.status : undefined
  const options = { message, sourceId, cause: error }
  if (status === 401 || /^(Invalid credentials|Collection query failed: 401)/.test(message)) {
    return new ApiError('unauthorized', options)
  }
  if (status === 403 || status === 405 || status === 409) return new ApiError('forbidden', options)
  if (status === 404 || /^Collection query failed: 404\b/.test(message)) {
    return new ApiError('notFound', options)
  }
  if (status === 412) return new ApiError('conflict', options)
  if (error instanceof TypeError) return new ApiError('unreachable', options)
  return new ApiError('unknown', options)
}

export function assertOk(response: Response) {
  if (!response.ok) throw new HttpError(response.status)
}
