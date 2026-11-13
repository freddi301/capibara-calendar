import { Trans, useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { getApi } from '@/api'
import SourceIcon from '@/components/SourceIcon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { groupBy } from 'es-toolkit'
import { refOfKey } from '@/lib/calendars'
import { syncErrorMessage } from '@/lib/errors'
import { clearSyncErrors, useSyncErrors, type SyncError } from '@/lib/sync-errors'
import { useCalendars } from '@/lib/use-calendars'

function SyncErrorList({ errors }: { errors: SyncError[] }) {
  const calendars = useCalendars().data ?? []
  const sources = getApi().sources()
  const bySource = groupBy(
    errors,
    ({ sourceId, calendarUrl }) => sourceId ?? refOfKey(calendarUrl ?? '/').sourceId,
  )
  return (
    <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto">
      {Object.entries(bySource).map(([id, failures]) => {
        const source = sources.find((one) => one.id === id)
        return (
          <section key={id} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 font-medium">
              {source && <SourceIcon kind={source.kind} className="size-4 text-muted-foreground" />}
              {source?.name ?? id}
            </h3>
            <ul className="flex flex-col gap-2">
              {failures.map(({ key, calendarUrl, error }) => {
                const calendar = calendars.find(({ url }) => url === calendarUrl)
                const detail = error instanceof Error ? error.message : ''
                return (
                  <li
                    key={key}
                    className="flex flex-col gap-0.5 border-l-2 border-destructive pl-3"
                  >
                    {calendarUrl && (
                      <span className="font-medium">
                        {calendar?.name ?? refOfKey(calendarUrl).calendarId}
                      </span>
                    )}
                    <span>{syncErrorMessage(error, calendarUrl !== undefined)}</span>
                    {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export default function SyncErrors() {
  const { t } = useLingui()
  const errors = useSyncErrors()
  const [shown, setShown] = useState<SyncError[]>()

  return (
    <>
      {errors.length > 0 && (
        <Button
          variant="ghost"
          className="size-11"
          aria-label={t`Sync errors`}
          onClick={() => {
            setShown(errors)
          }}
        >
          <span
            aria-hidden="true"
            className="size-3 animate-pulse rounded-full bg-destructive motion-reduce:animate-none"
          />
        </Button>
      )}
      <Dialog
        open={shown !== undefined}
        onOpenChange={(isOpen) => {
          if (isOpen) return
          setShown(undefined)
          clearSyncErrors()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Sync errors</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>
                These could not be read from their server. They go away when you close this.
              </Trans>
            </DialogDescription>
          </DialogHeader>
          <SyncErrorList errors={shown ?? []} />
          <DialogFooter>
            <Button
              onClick={() => {
                setShown(undefined)
                clearSyncErrors()
              }}
            >
              <Trans>Close</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
