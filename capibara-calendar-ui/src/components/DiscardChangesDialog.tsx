import { Trans } from '@lingui/react/macro'
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
import type { LeaveGuard } from '@/lib/use-leave-guard'

export default function DiscardChangesDialog({ guard }: { guard: LeaveGuard }) {
  return (
    <AlertDialog
      open={guard.isAsking}
      onOpenChange={(open) => {
        if (!open) guard.stay()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>Discard your changes?</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>What you changed has not been saved.</Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>Keep editing</Trans>
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90 dark:text-background"
            onClick={guard.discard}
          >
            <Trans>Discard</Trans>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
