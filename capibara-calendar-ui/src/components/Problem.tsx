import { Trans } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'

export default function Problem({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-md border border-destructive bg-background p-3 text-sm text-destructive"
    >
      <span>{message}</span>
      {onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          <Trans>Try again</Trans>
        </Button>
      )}
    </div>
  )
}
