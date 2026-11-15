import { Trans, useLingui } from '@lingui/react/macro'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import ContactPickerDialog from '@/components/ContactPickerDialog'
import ParticipationIcon from '@/components/ParticipationIcon'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ParticipationStatus } from '@/api/calendar-api'
import { participations } from '@/lib/event-schema'
import { participationLabels } from '@/lib/participation-labels'
import { useContactNames, useContacts } from '@/lib/use-contacts'
import { isWebxdc, webxdcSelfAddr } from '@/lib/webxdc'

type ParticipantValue = { id: string; status: ParticipationStatus }

type ParticipantsEditorProps = {
  value: ParticipantValue[]
  isReadOnly: boolean
  onChange: (value: ParticipantValue[]) => void
}

export default function ParticipantsEditor({
  value,
  isReadOnly,
  onChange,
}: ParticipantsEditorProps) {
  const { t, i18n } = useLingui()
  const contacts = useContacts()
  const names = useContactNames()
  const [isPicking, setPicking] = useState(false)
  const [asking, setAsking] = useState<ParticipantValue>()
  const [listRef] = useAutoAnimate()
  const answer = (id: string, status: ParticipationStatus) => {
    onChange(value.map((one) => (one.id === id ? { ...one, status } : one)))
  }
  const isOfSomeoneElse = (id: string) => isWebxdc() && id !== webxdcSelfAddr()
  const askedName = asking ? (names.get(asking.id) ?? t`Unknown`) : ''
  const available = (contacts.data ?? []).filter(
    ({ id }) => !value.some((participant) => participant.id === id),
  )
  return (
    <div ref={listRef} className="flex min-w-0 flex-col gap-2">
      {value.map((participant) => {
        const name = names.get(participant.id) ?? t`Unknown`
        return (
          <div key={participant.id} className="flex min-h-8 items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {isReadOnly ? (
              <span className="flex shrink-0 items-center">
                <ParticipationIcon status={participant.status} />
                <span className="sr-only">{i18n._(participationLabels[participant.status])}</span>
              </span>
            ) : (
              <>
                <Select
                  items={participations.map((status) => ({
                    value: status,
                    label: <ParticipationIcon status={status} />,
                  }))}
                  value={participant.status}
                  onValueChange={(status) => {
                    if (!status) return
                    if (isOfSomeoneElse(participant.id)) setAsking({ id: participant.id, status })
                    else answer(participant.id, status)
                  }}
                >
                  <SelectTrigger
                    className="w-auto shrink-0 gap-0 px-2.5 [&>svg]:hidden"
                    aria-label={t`Answer of ${name}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="w-auto! min-w-0!">
                    {participations.map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        aria-label={i18n._(participationLabels[status])}
                        hasIndicator={false}
                        className="min-h-11 justify-center px-3 data-selected:bg-accent"
                      >
                        <ParticipationIcon status={status} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  className="size-8 shrink-0 text-muted-foreground"
                  aria-label={t`Remove ${name}`}
                  onClick={() => {
                    onChange(value.filter((one) => one.id !== participant.id))
                  }}
                >
                  <X className="size-4" />
                </Button>
              </>
            )}
          </div>
        )
      })}
      <AlertDialog
        open={!!asking}
        onOpenChange={(open) => {
          if (!open) setAsking(undefined)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Change the answer of someone else?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                You are changing the answer of {askedName}. Do it only if they asked you to.
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Keep their answer</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (asking) answer(asking.id, asking.status)
              }}
            >
              <Trans>Change it</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!isReadOnly && (
        <>
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-fit gap-1 px-2 text-muted-foreground"
            onClick={() => {
              setPicking(true)
            }}
          >
            <Plus className="size-4" />
            <Trans>Add attendee</Trans>
          </Button>
          <ContactPickerDialog
            open={isPicking}
            contacts={available}
            isLoading={contacts.isPending}
            onOpenChange={setPicking}
            onPick={({ id }) => {
              onChange([...value, { id, status: 'needs-action' }])
            }}
            onPickAll={
              isWebxdc()
                ? (picked) => {
                    onChange([
                      ...value,
                      ...picked.map(({ id }) => ({ id, status: 'needs-action' as const })),
                    ])
                  }
                : undefined
            }
          />
        </>
      )}
    </div>
  )
}
