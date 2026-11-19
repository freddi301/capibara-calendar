import type {
  CalendarEvent,
  CalendarRights,
  EventStatus,
  Participant,
  ParticipationStatus,
} from '@/api/calendar-api'

export type EventActionRules = {
  answer: boolean
  current?: ParticipationStatus
  duplicate: boolean
  cancel: 'cancel' | 'restore' | undefined
  remove: boolean
}

export const isRepeating = (event: CalendarEvent) =>
  event.recurrenceRules.length > 0 || !!event.ref.recurrenceId

export const myParticipant = (participants: Participant[], selfIds: string[]) =>
  participants.find(({ id }) => selfIds.includes(id.toLowerCase()))

export function eventActionsFor(
  event: CalendarEvent,
  selfIds: string[],
  rights: CalendarRights | undefined,
  canCreate: boolean,
): EventActionRules {
  const mine = myParticipant(event.participants, selfIds)
  const canUpdate = rights?.update ?? true
  return {
    answer: !!mine && canUpdate,
    current: mine?.status,
    duplicate: !isRepeating(event) && canCreate,
    cancel: canUpdate ? (event.status === 'cancelled' ? 'restore' : 'cancel') : undefined,
    remove: rights?.remove ?? true,
  }
}

export const hasActions = ({ answer, duplicate, cancel, remove }: EventActionRules) =>
  answer || duplicate || cancel !== undefined || remove

const duplicateEvent = 'capibara-duplicate-event'

export const requestDuplicate = (event: CalendarEvent) => {
  window.dispatchEvent(new CustomEvent(duplicateEvent, { detail: event }))
}

export function onDuplicateRequested(listener: (event: CalendarEvent) => void) {
  const handler = (event: Event) => {
    listener((event as CustomEvent<CalendarEvent>).detail)
  }
  window.addEventListener(duplicateEvent, handler)
  return () => {
    window.removeEventListener(duplicateEvent, handler)
  }
}

export const statusAfter = (isCancelling: boolean): EventStatus =>
  isCancelling ? 'cancelled' : 'confirmed'

export const fromBottom = 'bottom' as const
