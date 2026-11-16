import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApi } from '@/api'
import { timeZoneId } from '@/api/calendar-api'
import { toDisplayEvent, type DisplayEvent } from './display-event'
import { eventQueryKey, monthsBetween, moveInChunks, refreshEvents } from './event-chunks'
import { errorMessage, isConflict } from './errors'
import { capitalize, formatFullDate } from './format'
import { arcParts, arcSvg, movePatch, shiftDate } from './move-event'
import { activeTimeZone } from './settings'
import { withSettledViewTransition } from './view-transition'

type Move = { event: DisplayEvent; days: number }

const undoSeconds = 8

const wording = cn('block text-muted-foreground')
const titled = cn('line-clamp-2 block font-bold break-words text-foreground')
const datesBox = cn('relative block pl-4.5')
const before = cn('block text-red-600 dark:text-red-400')
const after = cn('block font-medium text-primary dark:text-sidebar-primary')
const arc = cn('absolute inset-y-0 left-0 h-full w-4 text-muted-foreground')

export function useMoveEvent() {
  const client = useQueryClient()
  const { t, i18n } = useLingui()
  const mutation = useMutation({
    mutationFn: ({ event, days }: Move) =>
      getApi().updateEvent(
        event.source,
        movePatch(event.source, days, timeZoneId(activeTimeZone())),
        'all',
      ),
    onSuccess: async (saved, { event, days }) => {
      client.setQueryData(eventQueryKey(saved.ref), saved)
      const zone = timeZoneId(activeTimeZone())
      await withSettledViewTransition(() => {
        moveInChunks(client, event.calendarKey, event, toDisplayEvent(saved, zone))
      })
      await refreshEvents(
        client,
        [event.calendarKey],
        monthsBetween([
          event.startDate,
          event.endDate,
          shiftDate(event.startDate, days),
          shiftDate(event.endDate, days),
        ]),
      )
    },
  })

  const notMoved = (title: string) => (
    <>
      <span className={titled}>{title}</span>
      <span className={wording}>
        <Trans>Not moved</Trans>
      </span>
    </>
  )

  const move = ({ event, days }: Move, isUndo = false) => {
    mutation.mutate(
      { event, days },
      {
        onSuccess: (saved) => {
          if (isUndo) return
          const title = event.title
          const dayOf = (date: string) =>
            capitalize(formatFullDate(Temporal.PlainDate.from(date), i18n.locale), i18n.locale)
          const from = dayOf(event.startDate)
          const to = dayOf(shiftDate(event.startDate, days))
          toast(
            <>
              <span className={titled}>{title}</span>
              <span className="sr-only">
                <Trans>
                  moved from {from} to {to}
                </Trans>
              </span>
              <span aria-hidden="true" className={datesBox}>
                <svg className={arc} {...arcSvg}>
                  <path {...arcParts.curve} />
                  <path {...arcParts.head} />
                </svg>
                <span className={before}>{from}</span>
                <span className={after}>{to}</span>
              </span>
            </>,
            {
              duration: undoSeconds * 1000,
              action: {
                label: t`Undo`,
                onClick: () => {
                  move(
                    { event: toDisplayEvent(saved, timeZoneId(activeTimeZone())), days: -days },
                    true,
                  )
                },
              },
            },
          )
        },
        onError: (error) => {
          if (isConflict(error)) {
            void refreshEvents(client, [event.calendarKey])
            toast.error(notMoved(event.title), {
              description: t`It was changed on the server after it was loaded. The list is loaded again.`,
            })
            return
          }
          toast.error(notMoved(event.title), { description: errorMessage(error, 'save') })
        },
      },
    )
  }

  return {
    move,
    isPending: mutation.isPending,
    movingKey: mutation.isPending ? mutation.variables.event.key : undefined,
  }
}
