import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from 'cn'
import { FileUp } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { getApi } from '@/api'
import type { ImportOutcome } from '@/api/calendar-api'
import BottomBar from '@/components/BottomBar'
import CalendarPicker from '@/components/CalendarPicker'
import FilterBanner from '@/components/filter/FilterBanner'
import Problem from '@/components/Problem'
import SheetBack, { SheetTitle } from '@/components/SheetBack'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { refOfKey } from '@/lib/calendars'
import { refreshEvents } from '@/lib/event-chunks'
import { hasRules } from '@/lib/event-filter'
import { errorMessage } from '@/lib/errors'
import { pickCalendarFile, type PickedFile } from '@/lib/file-transfer'
import { parseCalendarFile, planImport, totalsOf } from '@/lib/ics-import'
import { useCalendars } from '@/lib/use-calendars'
import { useStored } from '@/lib/use-stored'

type ImportScreenProps = { onClose: () => void; onOpenFilters: () => void }

const figures = cn('text-right tabular-nums')

function Row({
  label,
  events,
  occurrences,
}: {
  label: ReactNode
  events: number
  occurrences: number
}) {
  return (
    <tr>
      <th scope="row" className="py-1 pr-3 text-left font-normal">
        {label}
      </th>
      <td className={cn(figures, 'py-1 pr-3 font-semibold')}>{events}</td>
      <td className={cn(figures, 'py-1 font-semibold')}>{occurrences}</td>
    </tr>
  )
}

/** A calendar file, put in a calendar: the events of it that are not there are new, and the newer ones replace. */
export default function ImportScreen({ onClose, onOpenFilters }: ImportScreenProps) {
  const { t } = useLingui()
  const client = useQueryClient()
  const calendars = useCalendars()
  const writable = (calendars.data ?? []).filter(({ rights }) => rights.create)
  const [chosen, setChosen] = useState<string>()
  const url = chosen ?? writable.at(0)?.url
  const rules = useStored((stored) => stored.eventFilter)
  const isFiltered = hasRules(rules)
  const [file, setFile] = useState<PickedFile>()
  const [isAsking, setAsking] = useState(false)
  const [result, setResult] = useState<ImportOutcome[]>()

  const fileName = file?.name ?? ''
  const parsed = useMemo(() => (file ? parseCalendarFile(file.text) : undefined), [file])
  const isNotCalendar = parsed?.problems.some(({ kind }) => kind === 'file') ?? false
  const there = useQuery({
    queryKey: ['import', url],
    queryFn: () => getApi().exportEvents(refOfKey(url ?? '')),
    enabled: url !== undefined && parsed !== undefined && !isNotCalendar,
    gcTime: 0,
    staleTime: 0,
  })
  const planned = useMemo(
    () => (parsed && there.data ? planImport(parsed.events, there.data, rules) : undefined),
    [parsed, there.data, rules],
  )
  const totals = useMemo(() => (planned ? totalsOf(planned) : undefined), [planned])
  const toWrite = (totals?.new.events ?? 0) + (totals?.update.events ?? 0)

  const write = useMutation({
    mutationFn: () => {
      const items = (planned ?? [])
        .filter(({ decision }) => decision === 'new' || decision === 'update')
        .map(({ uid, ics }) => ({ uid, ics }))
      return getApi().importEvents(refOfKey(url ?? ''), items)
    },
    onSuccess: async (outcomes) => {
      setResult(outcomes)
      await refreshEvents(client, url ? [url] : undefined)
    },
  })

  const choose = () => {
    void pickCalendarFile().then((picked) => {
      if (!picked) return
      setFile(picked)
      setResult(undefined)
      write.reset()
    })
  }
  const done = (kind: ImportOutcome['result']) =>
    result?.filter(({ result: one }) => one === kind).length ?? 0
  const unreadable = parsed?.problems.length ?? 0

  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 pt-15 pb-4 phone:pt-4 phone:pb-16">
        <SheetTitle>
          <Trans>Import</Trans>
        </SheetTitle>

        {isNotCalendar && <Problem message={t`This is not a calendar file.`} />}
        {there.isError && (
          <Problem
            message={errorMessage(there.error)}
            onRetry={() => {
              void there.refetch()
            }}
          />
        )}
        {write.isError && (
          <Problem
            message={errorMessage(write.error, 'save')}
            onRetry={() => {
              write.mutate()
            }}
          />
        )}

        {writable.length === 0 && calendars.isSuccess ? (
          <p className="rounded-md bg-muted/50 p-4 text-muted-foreground">
            <Trans>There is no calendar to import into. Make a calendar first.</Trans>
          </p>
        ) : (
          <CalendarPicker calendars={writable} value={url} onChange={setChosen} />
        )}

        <FilterBanner onChange={onOpenFilters} />

        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" className="h-11 gap-2 text-base" onClick={choose}>
            <FileUp className="size-5" aria-hidden="true" />
            {file ? <Trans>Choose another file</Trans> : <Trans>Choose a file</Trans>}
          </Button>
          {file && (
            <p className="text-sm break-all text-muted-foreground">
              <Trans>File: {fileName}</Trans>
            </p>
          )}
        </div>

        {result && (
          <>
            <section
              aria-label={t`What was imported`}
              className="flex flex-col gap-2 rounded-md bg-muted/50 p-4"
            >
              <p className="font-semibold">
                <Trans>Done</Trans>
              </p>
              <p>
                <Plural value={done('created')} one="# event added" other="# events added" />
              </p>
              <p>
                <Plural value={done('updated')} one="# event replaced" other="# events replaced" />
              </p>
              {done('failed') > 0 && (
                <p className="text-destructive">
                  <Plural
                    value={done('failed')}
                    one="# event could not be imported"
                    other="# events could not be imported"
                  />
                </p>
              )}
            </section>
          </>
        )}

        {file && !result && (
          <section
            aria-label={t`What will be imported`}
            className="flex flex-col gap-3 rounded-md bg-muted/50 p-4"
          >
            {totals && planned ? (
              <table className="w-full">
                <thead>
                  <tr className="text-sm text-muted-foreground">
                    <td />
                    <th scope="col" className="pr-3 text-right font-normal">
                      <Trans>Events</Trans>
                    </th>
                    <th scope="col" className="text-right font-normal">
                      <Trans>Customized occurrences</Trans>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <Row
                    label={<Trans>In the file</Trans>}
                    events={planned.length}
                    occurrences={planned.reduce((sum, { occurrences }) => sum + occurrences, 0)}
                  />
                  {isFiltered && (
                    <Row
                      label={<Trans>Ignored by the filter</Trans>}
                      events={totals.ignored.events}
                      occurrences={totals.ignored.occurrences}
                    />
                  )}
                  <Row
                    label={<Trans>New</Trans>}
                    events={totals.new.events}
                    occurrences={totals.new.occurrences}
                  />
                  <Row
                    label={<Trans>Replaced</Trans>}
                    events={totals.update.events}
                    occurrences={totals.update.occurrences}
                  />
                  <Row
                    label={<Trans>Already up to date</Trans>}
                    events={totals.current.events}
                    occurrences={totals.current.occurrences}
                  />
                </tbody>
              </table>
            ) : (
              !there.isError && (
                <p className="text-muted-foreground">
                  <Trans>Reading…</Trans>
                </p>
              )
            )}
            {parsed && parsed.skipped > 0 && (
              <p className="text-muted-foreground">
                <Plural
                  value={parsed.skipped}
                  one="# part of the file is not an event, and is left out."
                  other="# parts of the file are not events, and are left out."
                />
              </p>
            )}
            {unreadable > 0 && !isNotCalendar && (
              <p className="text-destructive">
                <Plural
                  value={unreadable}
                  one="# event could not be read."
                  other="# events could not be read."
                />
              </p>
            )}
          </section>
        )}

        <Button
          type="button"
          className="h-11 text-base"
          disabled={toWrite === 0 || write.isPending || !url}
          onClick={() => {
            if ((totals?.update.events ?? 0) > 0) setAsking(true)
            else write.mutate()
          }}
        >
          <Trans>Import</Trans>
        </Button>
      </main>

      <AlertDialog open={isAsking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Plural
                value={totals?.update.events ?? 0}
                one="Replace # event?"
                other="Replace # events?"
              />
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                They are in the calendar already, and the ones in the file are newer. They will be
                replaced.
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAsking(false)
                write.mutate()
              }}
            >
              <Trans>Replace</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomBar>
        <SheetBack
          onClick={() => {
            if (!write.isPending) onClose()
          }}
          title={<Trans>Import</Trans>}
        />
      </BottomBar>
    </>
  )
}
