import { Trans } from '@lingui/react/macro'
import { cn } from 'cn'
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

type ConflictDialogProps = {
  action?: 'save' | 'delete'
  onOverwrite: () => void
  onReload: () => void
  onCancel: () => void
}

export default function ConflictDialog({
  action,
  onOverwrite,
  onReload,
  onCancel,
}: ConflictDialogProps) {
  return (
    <AlertDialog
      open={action !== undefined}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>This event was changed somewhere else</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action === 'delete' ? (
              <Trans>It was changed after you opened it. You can delete it anyway.</Trans>
            ) : (
              <Trans>
                It was changed after you opened it. You can save your changes over it, or leave them
                and see the new version.
              </Trans>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-col sm:justify-stretch">
          <AlertDialogCancel className="w-full">
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <Button variant="outline" className="w-full" onClick={onReload}>
            <Trans>Show the new version</Trans>
          </Button>
          <AlertDialogAction
            className={cn(
              'w-full',
              action === 'delete' &&
                'bg-destructive text-white hover:bg-destructive/90 dark:text-background',
            )}
            onClick={onOverwrite}
          >
            {action === 'delete' ? <Trans>Delete anyway</Trans> : <Trans>Save anyway</Trans>}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
