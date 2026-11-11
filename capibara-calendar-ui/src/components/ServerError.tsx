import { Trans } from '@lingui/react/macro'

export default function ServerError() {
  return (
    <p className="py-6 text-sm text-destructive">
      <Trans>Cannot reach the CalDAV server</Trans>
    </p>
  )
}
