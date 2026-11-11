import { Trans } from '@lingui/react/macro'

export default function ListStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <>
      <h1 className="sr-only">Capibara Calendar</h1>
      <p role="status" className="sr-only">
        {isConnected && <Trans>Connected to the CalDAV server</Trans>}
      </p>
    </>
  )
}
