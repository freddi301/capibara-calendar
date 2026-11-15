import { Trans, useLingui } from '@lingui/react/macro'
import { Lock, Plus } from 'lucide-react'
import { useState } from 'react'
import BottomBar from '@/components/BottomBar'
import SheetBack, { SheetTitle } from '@/components/SheetBack'
import { Button } from '@/components/ui/button'
import SourceIcon from '@/components/SourceIcon'
import { Switch } from '@/components/ui/switch'
import { groupBySource, isReadOnly, type CalendarInfo } from '@/lib/calendars'
import { colorBorder, colorMark } from '@/lib/calendar-color'
import { hiddenCalendars, saveHiddenCalendars } from '@/lib/filter'
import { useCalendars } from '@/lib/use-calendars'

type CalendarsScreenProps = {
  onClose: () => void
  onEditCalendar: (calendar?: CalendarInfo) => void
}

export default function CalendarsScreen({ onClose, onEditCalendar }: CalendarsScreenProps) {
  const { t } = useLingui()
  const calendars = useCalendars()
  const [hidden, setHidden] = useState(hiddenCalendars)
  const change = (next: string[]) => {
    setHidden(next)
    saveHiddenCalendars(next)
  }
  const all = calendars.data?.map(({ url }) => url) ?? []
  const noneHidden = !all.some((url) => hidden.includes(url))
  const allHidden = all.every((url) => hidden.includes(url))

  return (
    <>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pt-15 pb-4 phone:pt-4 phone:pb-16">
        <SheetTitle isHidden>
          <Trans>Calendars</Trans>
        </SheetTitle>

        <section aria-label={t`Calendars`} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-end gap-3">
            <div className="flex gap-4">
              <Button
                variant="link"
                className="h-auto p-0 text-base dark:text-sidebar-primary"
                disabled={!calendars.isSuccess || noneHidden}
                onClick={() => {
                  change([])
                }}
              >
                <Trans>Show all</Trans>
              </Button>
              <Button
                variant="link"
                className="h-auto p-0 text-base dark:text-sidebar-primary"
                disabled={!calendars.isSuccess || allHidden}
                onClick={() => {
                  change(all)
                }}
              >
                <Trans>Hide all</Trans>
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            className="h-auto min-h-11 justify-start gap-3 rounded-md bg-muted/50 px-3 font-semibold text-foreground/70 hover:bg-muted/70"
            onClick={() => {
              onEditCalendar()
            }}
          >
            <Plus className="size-5" aria-hidden="true" />
            <Trans>New calendar</Trans>
          </Button>
          {groupBySource(calendars.data ?? []).map((group) => (
            <div
              key={group.sourceId}
              role="group"
              aria-label={group.name}
              className="flex flex-col gap-2"
            >
              <div className="mt-2 flex items-center gap-2 px-1 text-sm text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                <SourceIcon kind={group.kind} />
              </div>
              {group.calendars.map((calendar) => {
                const { url, name, color } = calendar
                return (
                  <div
                    key={url}
                    {...colorMark}
                    className="flex min-h-11 items-center gap-1 rounded-md border-r-4 bg-muted/50 pr-3"
                    style={colorBorder(color)}
                  >
                    <button
                      type="button"
                      className="min-h-11 min-w-0 flex-1 rounded-md px-3 text-left font-semibold break-words outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      onClick={() => {
                        onEditCalendar(calendar)
                      }}
                    >
                      {name}
                    </button>
                    {isReadOnly(calendar.rights) && (
                      <Lock
                        role="img"
                        aria-label={t`Read only`}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                    )}
                    <Switch
                      aria-label={name}
                      checked={!hidden.includes(url)}
                      onCheckedChange={(shown) => {
                        change(shown ? hidden.filter((item) => item !== url) : [...hidden, url])
                      }}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </section>
      </main>

      <BottomBar>
        <SheetBack onClick={onClose} title={<Trans>Calendars</Trans>} />
      </BottomBar>
    </>
  )
}
