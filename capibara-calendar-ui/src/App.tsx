import { Trans } from '@lingui/react/macro'

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-4 text-foreground">
      <h1 className="text-3xl font-bold">Capibara Calendar</h1>
      <p className="text-muted-foreground">
        <Trans>Your calendars, in one place</Trans>
      </p>
    </main>
  )
}
