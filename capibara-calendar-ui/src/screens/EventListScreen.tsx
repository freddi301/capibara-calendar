import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Settings } from 'lucide-react'
import BottomBar from '@/components/BottomBar'
import { Button } from '@/components/ui/button'
import { listEvents, type CalendarEvent } from '@/lib/caldav'

type EventListScreenProps = {
  onCreate: () => void
  onEdit: (event: CalendarEvent) => void
  onOpenSettings: () => void
}

export default function EventListScreen({
  onCreate,
  onEdit,
  onOpenSettings,
}: EventListScreenProps) {
  const { t } = useLingui()
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents })
  const editLabel = (title: string) => t`Edit ${title}`

  return (
    <>
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-4 pb-16">
        <h1 className="text-2xl font-bold">Capibara Calendar</h1>

        <p className={events.isError ? 'text-destructive' : 'text-muted-foreground'}>
          {events.isError ? (
            <Trans>Cannot reach the CalDAV server</Trans>
          ) : events.isSuccess ? (
            <Trans>Connected to the CalDAV server</Trans>
          ) : null}
        </p>

        <ul className="flex flex-col divide-y">
          {events.data?.map((event) => (
            <li key={event.url} className="flex items-center gap-2 py-1">
              <span className="min-w-0 flex-1 font-medium break-words">{event.title}</span>
              <time className="whitespace-nowrap text-muted-foreground">
                {event.startTime ? `${event.startDate} ${event.startTime}` : event.startDate}
              </time>
              <Button
                variant="ghost"
                className="size-11"
                aria-label={editLabel(event.title)}
                onClick={() => {
                  onEdit(event)
                }}
              >
                <Pencil />
              </Button>
            </li>
          ))}
          {events.isSuccess && !events.data.length && (
            <li className="py-3 text-muted-foreground">
              <Trans>No events yet</Trans>
            </li>
          )}
        </ul>
      </main>

      <BottomBar>
        <Button
          variant="ghost"
          className="size-11 text-secondary-foreground"
          aria-label={t`Settings`}
          onClick={onOpenSettings}
        >
          <Settings className="size-6" />
        </Button>
        <Button
          variant="ghost"
          className="ml-auto size-11 text-primary"
          aria-label={t`New event`}
          onClick={onCreate}
        >
          <Plus className="size-6" />
        </Button>
      </BottomBar>
    </>
  )
}
