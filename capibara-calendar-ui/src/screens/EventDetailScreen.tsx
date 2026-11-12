import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowLeft, Bell, MapPin, Pencil, Repeat, Tag, Video } from 'lucide-react'
import BottomBar, { BottomBarTitle } from '@/components/BottomBar'
import DurationSummary from '@/components/DurationSummary'
import { RowIcon } from '@/components/EventDetails'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CalendarEvent } from '@/lib/caldav'
import { colorBorder, colorMark } from '@/lib/calendar-color'
import { formatDate, formatTime } from '@/lib/format'
import { parseEvent, repeatFrom } from '@/lib/ical'
import { customReminderLabel, reminderLabels } from '@/lib/reminder-labels'
import { repeatSummary } from '@/lib/repeat-summary'
import { splitTags } from '@/lib/tags'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useCalendars } from '@/lib/use-calendars'

type EventDetailScreenProps = {
  event: CalendarEvent
  onEdit: () => void
  onClose: () => void
}

function withRepeat(event: CalendarEvent): CalendarEvent {
  try {
    if (event.occurrenceId) {
      return { ...event, ...repeatFrom(event.ics, event.occurrenceId, activeTimeZone()) }
    }
    if (event.isRecurring) return { ...event, ...parseEvent(event.ics, activeTimeZone()) }
  } catch {
    // an event that cannot be read again is shown as it is
  }
  return event
}

/** A link that is of the web only: an address of another kind is shown, and is not followed. */
function isWebAddress(value: string) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function Row({
  icon,
  children,
}: {
  icon: Parameters<typeof RowIcon>[0]['icon']
  children: ReactNode
}) {
  return (
    <>
      <RowIcon icon={icon} />
      <div className="flex min-h-8 min-w-0 items-center break-words">{children}</div>
    </>
  )
}

export default function EventDetailScreen({ event, onEdit, onClose }: EventDetailScreenProps) {
  const { t, i18n } = useLingui()
  const calendars = useCalendars()
  const calendar = calendars.data?.find(({ url }) => url === event.calendarUrl)
  const color = calendar?.color ?? event.color
  const shown = withRepeat(event)
  const tags = splitTags(shown.tags ?? '')
  const repeat = repeatSummary(shown, i18n.locale, activeWeekStart())
  const location = (shown.location ?? '').trim()
  const link = (shown.videoLink ?? '').trim()
  const reminder = shown.reminder
  const reminderLabel =
    reminder === 'custom'
      ? customReminderLabel
      : reminder
        ? reminderLabels[reminder as keyof typeof reminderLabels]
        : undefined
  const { startDate, startTime, endDate, endTime } = event
  const hasEnd = !!endDate || !!endTime
  const range = { startDate, startTime, endDate, endTime }

  return (
    <>
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 p-4 pt-15 pb-4 phone:pt-4 phone:pb-16">
        {calendar && (
          <div
            {...colorMark}
            className="flex h-8 items-center rounded-lg border border-l-4 px-2.5 text-sm"
            style={colorBorder(color)}
          >
            {calendar.name}
          </div>
        )}

        <h2 className="py-1 text-2xl font-bold break-words">{event.title}</h2>

        <div className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-3 gap-y-2 text-base">
          <span className="text-right text-muted-foreground">
            <Trans>Starts</Trans>
          </span>
          <span className="tabular-nums">{formatDate(startDate, i18n.locale)}</span>
          <span className="tabular-nums">{startTime && formatTime(startTime, i18n.locale)}</span>
          <DurationSummary range={range} part="days" />
          {hasEnd && (
            <>
              <span className="text-right text-muted-foreground">
                <Trans>Ends</Trans>
              </span>
              <span className="tabular-nums">{formatDate(endDate || startDate, i18n.locale)}</span>
              <span className="tabular-nums">{endTime && formatTime(endTime, i18n.locale)}</span>
              <DurationSummary range={range} part="time" />
            </>
          )}
        </div>

        {(repeat || tags.length > 0 || link || location || reminderLabel) && (
          <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3">
            {repeat && <Row icon={Repeat}>{repeat}</Row>}
            {tags.length > 0 && (
              <Row icon={Tag}>
                <div role="group" aria-label={t`Tags`} className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="h-8 rounded-lg px-2.5 text-base font-normal md:text-sm"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Row>
            )}
            {link && (
              <Row icon={Video}>
                {isWebAddress(link) ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 break-all text-primary underline underline-offset-2 dark:text-sidebar-primary"
                  >
                    {link}
                  </a>
                ) : (
                  <span className="break-all">{link}</span>
                )}
              </Row>
            )}
            {location && <Row icon={MapPin}>{location}</Row>}
            {reminderLabel && <Row icon={Bell}>{i18n._(reminderLabel)}</Row>}
          </div>
        )}

        {event.description.trim() && (
          <p className="break-words whitespace-pre-wrap">{event.description}</p>
        )}
      </main>

      <BottomBar>
        <Button
          variant="ghost"
          className="size-11 text-muted-foreground"
          aria-label={t`Back`}
          onClick={onClose}
        >
          <ArrowLeft />
        </Button>
        <BottomBarTitle>
          <Trans>Event</Trans>
        </BottomBarTitle>
        <Button
          variant="ghost"
          className="ml-auto size-11 text-primary dark:text-sidebar-primary"
          aria-label={t`Edit`}
          onClick={onEdit}
        >
          <Pencil className="size-6" />
        </Button>
      </BottomBar>
    </>
  )
}
