import { Trans, useLingui } from '@lingui/react/macro'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import ContactPickerDialog from '@/components/ContactPickerDialog'
import ParticipationIcon from '@/components/ParticipationIcon'
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

export type ParticipantValue = { id: string; status: ParticipationStatus }

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
  const [listRef] = useAutoAnimate()
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
                    onChange(
                      value.map((one) => (one.id === participant.id ? { ...one, status } : one)),
                    )
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
          />
        </>
      )}
    </div>
  )
}
