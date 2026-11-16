import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowLeft, Bell, MapPin, Pencil, Repeat, Tag, Video } from 'lucide-react'
import { cn } from 'cn'
import BottomBar, { BottomBarTitle } from '@/components/BottomBar'
import EventWhen from '@/components/EventWhen'
import { RowIcon } from '@/components/EventDetails'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { timeZoneId, type CalendarEvent } from '@/api/calendar-api'
import { displayTimes, timeOf } from '@/api/shared/zones'
import { SourceTag } from '@/components/SourceIcon'
import { colorBorder, colorMark, eventBorder } from '@/lib/calendar-color'
import { formValuesOf, minutesOfAlert } from '@/lib/event-form'
import { customReminderLabel, reminderLabels } from '@/lib/reminder-labels'
import ParticipantsBlock from '@/components/ParticipantsBlock'
import ParticipationIcon from '@/components/ParticipationIcon'
import StatusIcon from '@/components/StatusIcon'
import { participationLabels } from '@/lib/participation-labels'
import { statusLabels } from '@/lib/status-labels'
import { useContactNames } from '@/lib/use-contacts'
import { repeatSummary } from '@/lib/repeat-summary'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useCalendars } from '@/lib/use-calendars'

type EventDetailScreenProps = {
  event: CalendarEvent
  onEdit: () => void
  onClose: () => void
}

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
  const appZone = timeZoneId(activeTimeZone())
  const calendar = calendars.data?.find(
    ({ ref }) => ref.sourceId === event.ref.sourceId && ref.calendarId === event.ref.calendarId,
  )
  const color = calendar?.color ?? event.calendarColor
  const canEdit = calendar?.rights.update ?? true
  const names = useContactNames()
  const form = formValuesOf(event, { appZone })
  const tags = event.keywords
  const repeat = repeatSummary(form, i18n.locale, activeWeekStart())
  const location = (event.locations.at(0)?.name ?? '').trim()
  const link = (event.virtualLocations.at(0)?.uri ?? '').trim()
  const alertLabels = event.alerts.map((alert) => {
    const minutes = minutesOfAlert(alert)
    const label = reminderLabels[String(minutes) as keyof typeof reminderLabels] as
      typeof customReminderLabel | undefined
    return label ?? customReminderLabel
  })
  const times = displayTimes(event, appZone)
  const ownZone = !event.showWithoutTime && event.timeZone && event.timeZone !== appZone

  return (
    <>
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 p-4 pt-15 pb-4 phone:pt-4 phone:pb-16">
        {calendar && (
          <div
            {...colorMark}
            className="flex h-8 items-center rounded-lg border border-r-4 px-2.5 text-sm"
            style={colorBorder(color)}
          >
            <span className="min-w-0 flex-1 truncate">{calendar.name}</span>
            <SourceTag
              kind={calendar.sourceKind}
              name={calendar.sourceName}
              className="ml-2 max-w-[40%]"
            />
          </div>
        )}

        <h2
          className={cn('py-1 text-2xl font-bold break-words', event.color && 'border-b-4')}
          style={eventBorder(event.color)}
        >
          {event.title}
        </h2>

        {event.status !== 'confirmed' && (
          <div className="flex justify-center">
            <Badge variant="outline" className="h-7 gap-1.5 px-3 text-sm">
              <StatusIcon status={event.status} />
              {i18n._(statusLabels[event.status])}
            </Badge>
          </div>
        )}

        <EventWhen event={times} />
        {ownZone && (
          <p className="text-sm text-muted-foreground">
            {timeOf(event.start)} {event.timeZone}
          </p>
        )}

        {(repeat || tags.length > 0 || link || location || alertLabels.length > 0) && (
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
            {alertLabels.length > 0 && (
              <Row icon={Bell}>
                <div className="flex flex-col">
                  {alertLabels.map((label, index) => (
                    <span key={index}>{i18n._(label)}</span>
                  ))}
                </div>
              </Row>
            )}
          </div>
        )}

        {event.description.trim() && (
          <p className="break-words whitespace-pre-wrap">{event.description}</p>
        )}

        {event.participants.length > 0 && (
          <ParticipantsBlock statuses={event.participants.map(({ status }) => status)}>
            <div className="flex w-full min-w-0 flex-col gap-1.5 py-1">
              {event.participants.map(({ id, status }) => (
                <div key={id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{names.get(id) ?? t`Unknown`}</span>
                  <span className="flex shrink-0 items-center">
                    <ParticipationIcon status={status} />
                    <span className="sr-only">{i18n._(participationLabels[status])}</span>
                  </span>
                </div>
              ))}
            </div>
          </ParticipantsBlock>
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
        {canEdit && (
          <Button
            variant="ghost"
            className="ml-auto size-11 text-primary dark:text-sidebar-primary"
            aria-label={t`Edit`}
            onClick={onEdit}
          >
            <Pencil className="size-6" />
          </Button>
        )}
      </BottomBar>
    </>
  )
}
