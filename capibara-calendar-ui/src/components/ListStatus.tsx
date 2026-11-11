import { Trans } from '@lingui/react/macro'
import { useOnline } from '@/lib/use-online'

export default function ListStatus({ isConnected }: { isConnected: boolean }) {
  const isOnline = useOnline()
  return (
    <>
      <h1 className="sr-only">Capibara Calendar</h1>
      <p role="status" className="sr-only">
        {isConnected && isOnline && <Trans>Connected to the CalDAV server</Trans>}
      </p>
      {!isOnline && (
        <p className="bg-muted px-4 py-1 text-center text-sm text-foreground/70">
          <Trans>No network. You see what was loaded last.</Trans>
        </p>
      )}
    </>
  )
}
