import { isUndefined, omitBy } from 'es-toolkit'
import type { EventPatch, EventValues, Participant, ParticipantsPatch } from '../calendar-api'

export function withParticipants(list: Participant[], { set, remove }: ParticipantsPatch) {
  const gone = new Set<string>(remove)
  const kept = list
    .filter(({ id }) => !gone.has(id))
    .map((one) => set.find(({ id }) => id === one.id) ?? one)
  const added = set.filter(({ id }) => !list.some((one) => one.id === id))
  return [...kept, ...added]
}

export const told = (fields: object) => omitBy(fields, isUndefined) as Partial<EventValues>

export function applyPatch(values: EventValues, patch: EventPatch): EventValues {
  const { participants, ...fields } = patch
  return {
    ...values,
    ...told(fields),
    participants: participants
      ? withParticipants(values.participants, participants)
      : values.participants,
  }
}
