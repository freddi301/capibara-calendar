import { Trans, useLingui } from '@lingui/react/macro'
import { UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Contact } from '@/api/calendar-api'

type ContactPickerDialogProps = {
  open: boolean
  contacts: Contact[]
  isLoading: boolean
  onOpenChange: (open: boolean) => void
  onPick: (contact: Contact) => void
  onPickAll?: (contacts: Contact[]) => void
}

export default function ContactPickerDialog({
  open,
  contacts,
  isLoading,
  onOpenChange,
  onPick,
  onPickAll,
}: ContactPickerDialogProps) {
  const { t } = useLingui()
  const [search, setSearch] = useState('')
  const shown = contacts.filter(({ name }) =>
    name.toLowerCase().includes(search.trim().toLowerCase()),
  )
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch('')
        onOpenChange(next)
      }}
    >
      <DialogContent className="top-4 flex max-h-[80dvh] translate-y-0 flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <Trans>Add attendee</Trans>
          </DialogTitle>
          <DialogDescription className="sr-only">
            <Trans>Choose one of your contacts</Trans>
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label={t`Search contacts`}
          placeholder={t`Search contacts`}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
          }}
        />
        <div className="-mx-4 -mt-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_1rem,black_calc(100%_-_1rem),transparent)] py-4">
          {onPickAll && shown.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-11 justify-start gap-2 rounded-none px-4 py-2 text-left text-base font-medium whitespace-normal"
              onClick={() => {
                onPickAll(shown)
                setSearch('')
                onOpenChange(false)
              }}
            >
              <UsersRound className="size-4" />
              <Trans>Add all</Trans>
            </Button>
          )}
          {shown.map((contact) => (
            <Button
              key={contact.id}
              type="button"
              variant="ghost"
              className="h-auto min-h-11 justify-start rounded-none px-4 py-2 text-left text-base font-normal whitespace-normal"
              onClick={() => {
                onPick(contact)
                setSearch('')
                onOpenChange(false)
              }}
            >
              {contact.name}
            </Button>
          ))}
          {shown.length === 0 && (
            <p className="px-4 py-6 text-center text-muted-foreground">
              {isLoading ? <Trans>Loading contacts</Trans> : <Trans>No contacts to add</Trans>}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
