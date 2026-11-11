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
import type { CalendarEvent, EditScope } from '@/lib/caldav'

type EditScopeDialogProps = {
  event?: CalendarEvent
  onChoose: (event: CalendarEvent, scope: EditScope) => void
  onCancel: () => void
}

export default function EditScopeDialog({ event, onChoose, onCancel }: EditScopeDialogProps) {
  return (
    <AlertDialog
      open={!!event}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <Trans>Edit a repeating event</Trans>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <Trans>
              Do you want to change only this event, this one and the ones after it, or all the
              events of the repeat?
            </Trans>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            onClick={() => {
              if (event) onChoose(event, 'one')
            }}
          >
            <Trans>Only this event</Trans>
          </AlertDialogAction>
          <AlertDialogAction
            variant="outline"
            onClick={() => {
              if (event) onChoose(event, 'following')
            }}
          >
            <Trans>This and following</Trans>
          </AlertDialogAction>
          <AlertDialogAction
            onClick={() => {
              if (event) onChoose(event, 'all')
            }}
          >
            <Trans>All events</Trans>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
