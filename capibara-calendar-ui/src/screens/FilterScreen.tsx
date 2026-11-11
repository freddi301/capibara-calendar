import { Trans, useLingui } from '@lingui/react/macro'
import { ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'
import BottomBar from '@/components/BottomBar'
import ServerError from '@/components/ServerError'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { CalendarInfo } from '@/lib/caldav'
import { colorBorder, colorMark } from '@/lib/calendar-color'
import { hiddenCalendars, saveHiddenCalendars } from '@/lib/filter'
import { useCalendars } from '@/lib/use-calendars'

type FilterScreenProps = {
  onClose: () => void
  onEditCalendar: (calendar?: CalendarInfo) => void
}

export default function FilterScreen({ onClose, onEditCalendar }: FilterScreenProps) {
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
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4 pb-16">
        <h1 className="text-2xl font-bold text-muted-foreground">
          <Trans>Filter</Trans>
        </h1>

        <section aria-labelledby="calendars-title" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="calendars-title" className="text-sm font-semibold text-muted-foreground">
              <Trans>Calendars</Trans>
            </h2>
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

          {calendars.isError && <ServerError />}
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
          {calendars.data?.map((calendar) => {
            const { url, name, color } = calendar
            return (
              <div
                key={url}
                {...colorMark}
                className="flex min-h-11 items-center gap-1 rounded-md border-l-4 bg-muted/50 pr-3"
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
        </section>
      </main>

      <BottomBar>
        <Button
          variant="ghost"
          className="h-11 w-full text-muted-foreground"
          aria-label={t`Back`}
          onClick={onClose}
        >
          <ChevronDown className="size-6" />
        </Button>
      </BottomBar>
    </>
  )
}
