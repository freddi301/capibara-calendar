import { useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { getApi } from '@/api'
import {
  calendarKey,
  eventKey,
  timeZoneId,
  type CalendarEvent,
  type EditScope,
  type ParticipationStatus,
} from '@/api/calendar-api'
import EditScopeDialog from '@/components/EditScopeDialog'
import { toDisplayEvent } from './display-event'
import { eventValuesOf, formValuesOf } from './event-form'
import { moveInChunks, refreshEvents, removeFromChunks } from './event-chunks'
import {
  eventActionsFor,
  isRepeating,
  myParticipant,
  requestDuplicate,
  statusAfter,
} from './event-actions'
import { errorMessage } from './errors'
import { activeTimeZone } from './settings'
import { useCalendars } from './use-calendars'
import { useSelfIds } from './use-self-ids'
import { withSettledViewTransition } from './view-transition'

const undoSeconds = 8

/** The quick actions of an event: what applies to it, and doing them, with what they say when done. */
export function useEventActions(event: CalendarEvent) {
  const client = useQueryClient()
  const { t } = useLingui()
  const calendars = useCalendars()
  const key = calendarKey(event.ref)
  const calendar = calendars.data?.find(({ ref }) => calendarKey(ref) === key)
  const selfIds = useSelfIds(calendar?.sourceKind, event.ref.sourceId)
  const rules = eventActionsFor(
    event,
    selfIds,
    calendar?.rights,
    (calendars.data ?? []).some(({ rights }) => rights.create),
  )
  const [pending, setPending] = useState<(scope: EditScope) => void>()
  const zone = timeZoneId(activeTimeZone())
  const title = event.title

  // A series, or one of its days, asks which of them the action is for.
  const withScope = (run: (scope: EditScope) => void) => {
    if (isRepeating(event)) setPending(() => run)
    else run('all')
  }
  const refresh = () => refreshEvents(client, [key])
  const fail = (error: unknown) => {
    void refresh()
    toast.error(title, { description: errorMessage(error, 'save') })
  }

  const answer = (status: ParticipationStatus) => {
    const me = myParticipant(event.participants, selfIds)
    if (!me) return
    withScope((scope) => {
      getApi()
        .updateEvent(event, { participants: { set: [{ id: me.id, status }], remove: [] } }, scope)
        .then(refresh, fail)
    })
  }

  const toggleCancel = () => {
    const isCancelling = rules.cancel === 'cancel'
    const before = event.status
    withScope((scope) => {
      getApi()
        .updateEvent(event, { status: statusAfter(isCancelling) }, scope)
        .then(async (saved) => {
          await withSettledViewTransition(() => {
            moveInChunks(client, key, toDisplayEvent(event, zone), toDisplayEvent(saved, zone))
          }, 'fade')
          await refresh()
          if (!isCancelling) return
          toast(t`${title} cancelled`, {
            duration: undoSeconds * 1000,
            action: {
              label: t`Undo`,
              onClick: () => {
                getApi().updateEvent(saved, { status: before }, scope).then(refresh, fail)
              },
            },
          })
        }, fail)
    })
  }

  const remove = () => {
    withScope((scope) => {
      getApi()
        .deleteEvent(event, scope)
        .then(async () => {
          await withSettledViewTransition(() => {
            removeFromChunks(client, key, eventKey(event.ref))
          }, 'fade')
          await refresh()
          const options = { appZone: zone }
          toast(t`${title} deleted`, {
            duration: undoSeconds * 1000,
            // A copy of what was there: a deleted event is made again. Not for a series.
            action: isRepeating(event)
              ? undefined
              : {
                  label: t`Undo`,
                  onClick: () => {
                    const values = eventValuesOf(formValuesOf(event, options), undefined, options)
                    getApi()
                      .createEvent(
                        { sourceId: event.ref.sourceId, calendarId: event.ref.calendarId },
                        values,
                      )
                      .then(refresh, fail)
                  },
                },
          })
        }, fail)
    })
  }

  const scopeDialog = (
    <EditScopeDialog
      event={pending ? event : undefined}
      onChoose={(_, scope) => {
        const run = pending
        setPending(undefined)
        run?.(scope)
      }}
      onCancel={() => {
        setPending(undefined)
      }}
    />
  )

  return {
    rules,
    answer,
    toggleCancel,
    remove,
    duplicate: () => {
      requestDuplicate(event)
    },
    scopeDialog,
  }
}
