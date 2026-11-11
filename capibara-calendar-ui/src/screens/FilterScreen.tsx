import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import BottomBar from '@/components/BottomBar'
import ServerError from '@/components/ServerError'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { listCalendars } from '@/lib/caldav'
import { hiddenCalendars, saveHiddenCalendars } from '@/lib/filter'

export default function FilterScreen({ onClose }: { onClose: () => void }) {
  const { t } = useLingui()
  const calendars = useQuery({ queryKey: ['calendars'], queryFn: listCalendars })
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
          <h2 id="calendars-title" className="text-sm font-semibold text-muted-foreground">
            <Trans>Calendars</Trans>
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1"
              disabled={!calendars.isSuccess || noneHidden}
              onClick={() => {
                change([])
              }}
            >
              <Trans>Show all</Trans>
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1"
              disabled={!calendars.isSuccess || allHidden}
              onClick={() => {
                change(all)
              }}
            >
              <Trans>Hide all</Trans>
            </Button>
          </div>

          {calendars.isError && <ServerError />}
          {calendars.data?.map(({ url, name }) => (
            <label
              key={url}
              className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-muted/50 px-3"
            >
              <span className="min-w-0 font-semibold break-words">{name}</span>
              <Switch
                aria-label={name}
                checked={!hidden.includes(url)}
                onCheckedChange={(shown) => {
                  change(shown ? hidden.filter((item) => item !== url) : [...hidden, url])
                }}
              />
            </label>
          ))}
        </section>
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
      </BottomBar>
    </>
  )
}
