import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'
import { FileDown, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getApi } from '@/api'
import BottomBar from '@/components/BottomBar'
import CalendarPicker from '@/components/CalendarPicker'
import FilterBanner from '@/components/filter/FilterBanner'
import FilterLine from '@/components/filter/FilterLine'
import Problem from '@/components/Problem'
import SheetBack, { SheetTitle } from '@/components/SheetBack'
import { Button } from '@/components/ui/button'
import { refOfKey } from '@/lib/calendars'
import { errorMessage } from '@/lib/errors'
import { saveCalendarFile } from '@/lib/file-transfer'
import { useEventFilter } from '@/lib/event-filter-store'
import { buildCalendarFile, countEvents, icsFileName, splitByFilter } from '@/lib/ics-file'
import { hasRules } from '@/lib/event-filter'
import { useCalendars } from '@/lib/use-calendars'
import { isWebxdc } from '@/lib/webxdc'

type ExportScreenProps = { onClose: () => void; onOpenFilters: () => void }

const figures = cn('text-2xl font-bold tabular-nums')

export default function ExportScreen({ onClose, onOpenFilters }: ExportScreenProps) {
  const { t } = useLingui()
  const calendars = useCalendars()
  const [isConfirming, setConfirming] = useState(false)
  const [chosen, setChosen] = useState<string>()
  const list = calendars.data ?? []
  const url = chosen ?? list.at(0)?.url
  const calendar = list.find((one) => one.url === url)

  const events = useQuery({
    queryKey: ['export', url],
    queryFn: () => getApi().exportEvents(refOfKey(url ?? '')),
    enabled: url !== undefined,
    gcTime: 0,
    staleTime: 0,
  })
  const rules = useEventFilter()
  const isFiltered = hasRules(rules)
  const split = useMemo(
    () => (events.data ? splitByFilter(events.data, rules) : undefined),
    [events.data, rules],
  )
  const counts = useMemo(() => (split ? countEvents(split.included) : undefined), [split])
  const leftOut = useMemo(() => (split ? countEvents(split.left) : undefined), [split])
  const fileName = icsFileName(calendar?.name ?? '')
  const calendarName = calendar?.name ?? ''
  const isEmpty = counts !== undefined && counts.events === 0
  const inChat = isWebxdc()

  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 pt-15 pb-4 phone:pt-4 phone:pb-16">
        <SheetTitle>
          <Trans>Export</Trans>
        </SheetTitle>

        {events.isError && (
          <Problem
            message={errorMessage(events.error)}
            onRetry={() => {
              void events.refetch()
            }}
          />
        )}

        {!isConfirming ? (
          <>
            <CalendarPicker calendars={list} value={url} onChange={setChosen} />
            <FilterBanner onChange={onOpenFilters} />
            <Button
              type="button"
              className="h-11 text-base"
              disabled={!calendar}
              onClick={() => {
                setConfirming(true)
              }}
            >
              <Trans>Next</Trans>
            </Button>
          </>
        ) : (
          <>
            <section
              aria-label={t`What will be exported`}
              className="flex flex-col gap-3 rounded-md bg-muted/50 p-4"
            >
              <p className="text-sm text-muted-foreground">
                <Trans>Calendar: {calendarName}</Trans>
              </p>
              <p className="text-sm">
                <FilterLine />
              </p>
              {counts ? (
                <>
                  <p className="flex items-baseline gap-2">
                    <span className={figures}>{counts.events}</span>{' '}
                    <span>
                      <Plural value={counts.events} one="event" other="events" />
                    </span>
                  </p>
                  <p className="flex items-baseline gap-2">
                    <span className={figures}>{counts.occurrences}</span>{' '}
                    <span>
                      <Plural
                        value={counts.occurrences}
                        one="customized occurrence"
                        other="customized occurrences"
                      />
                    </span>
                  </p>
                  {counts.series > 0 && (
                    <p className="text-muted-foreground">
                      <Plural
                        value={counts.series}
                        one="# of the events repeats"
                        other="# of the events repeat"
                      />
                    </p>
                  )}
                  {isFiltered && leftOut && leftOut.events > 0 && (
                    <p className="text-muted-foreground">
                      <Plural
                        value={leftOut.events}
                        one="# event left out by the filter"
                        other="# events left out by the filter"
                      />
                    </p>
                  )}
                  {isFiltered && leftOut && leftOut.occurrences > 0 && (
                    <p className="text-muted-foreground">
                      <Plural
                        value={leftOut.occurrences}
                        one="# customized occurrence left out by the filter"
                        other="# customized occurrences left out by the filter"
                      />
                    </p>
                  )}
                  {isEmpty && (
                    <p className="text-muted-foreground">
                      {isFiltered && leftOut && leftOut.events > 0 ? (
                        <Trans>No event of this calendar passes the filter.</Trans>
                      ) : (
                        <Trans>There is nothing in this calendar to export.</Trans>
                      )}
                    </p>
                  )}
                </>
              ) : (
                !events.isError && (
                  <p className="text-muted-foreground">
                    <Trans>Reading the calendar…</Trans>
                  </p>
                )
              )}
              {calendar && (
                <p className="text-sm break-all text-muted-foreground">
                  <Trans>File: {fileName}</Trans>
                </p>
              )}
            </section>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 text-base"
                onClick={() => {
                  setConfirming(false)
                }}
              >
                <Trans>Back</Trans>
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 gap-2 text-base"
                disabled={!split || isEmpty || !calendar}
                onClick={() => {
                  if (!split || !calendar) return
                  saveCalendarFile(
                    fileName,
                    buildCalendarFile(calendar.name, split.included),
                  ).catch(() => {
                    toast.error(t`The file could not be sent to the chat.`)
                  })
                }}
              >
                {inChat ? (
                  <Send className="size-5" aria-hidden="true" />
                ) : (
                  <FileDown className="size-5" aria-hidden="true" />
                )}
                {inChat ? <Trans>Send to a chat</Trans> : <Trans>Export</Trans>}
              </Button>
            </div>
          </>
        )}
      </main>

      <BottomBar>
        <SheetBack
          onClick={() => {
            if (isConfirming) setConfirming(false)
            else onClose()
          }}
          title={<Trans>Export</Trans>}
        />
      </BottomBar>
    </>
  )
}
