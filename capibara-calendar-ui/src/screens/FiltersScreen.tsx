import { Trans } from '@lingui/react/macro'
import { UserCheck } from 'lucide-react'
import BottomBar from '@/components/BottomBar'
import FilterTree from '@/components/filter/FilterTree'
import SheetBack, { SheetTitle } from '@/components/SheetBack'
import { Button } from '@/components/ui/button'
import { addNode, emptyFilter, toConfirmRule, type Group } from '@/lib/event-filter'
import { useFilterSuggestions } from '@/lib/filter-suggestions'
import { useContacts } from '@/lib/use-contacts'
import { setStored, useStored } from '@/lib/use-stored'
import { webxdcSelf } from '@/lib/webxdc'

type FiltersScreenProps = { onClose: () => void }

const editEventFilter = (change: (root: Group) => Group) => {
  setStored(({ eventFilter }) => ({ eventFilter: change(eventFilter) }))
}

export default function FiltersScreen({ onClose }: FiltersScreenProps) {
  const root = useStored((stored) => stored.eventFilter)
  const contacts = useContacts()
  const suggestions = useFilterSuggestions(contacts.data)
  const me = webxdcSelf()

  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 p-4 pt-15 pb-4 phone:pt-4 phone:pb-16">
        <SheetTitle isHidden>
          <Trans>Filter</Trans>
        </SheetTitle>

        <div className="flex items-center justify-between gap-3">
          <span className="text-base text-muted-foreground">
            <Trans>Show events where</Trans>
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-base text-muted-foreground"
            disabled={root.children.length === 0}
            onClick={() => {
              setStored({ eventFilter: emptyFilter() })
            }}
          >
            <Trans>Reset</Trans>
          </Button>
        </div>

        {me && (
          <Button
            type="button"
            variant="outline"
            className="h-9 w-fit gap-2 text-base"
            onClick={() => {
              // It is added to the rules that there are, and does not take their place.
              editEventFilter((rules) => addNode(rules, rules.id, toConfirmRule(me)))
            }}
          >
            <UserCheck className="size-4" aria-hidden="true" />
            <Trans>To confirm attendance</Trans>
          </Button>
        )}

        <FilterTree root={root} edit={editEventFilter} suggestions={suggestions} />
      </main>

      <BottomBar>
        <SheetBack onClick={onClose} title={<Trans>Filter</Trans>} />
      </BottomBar>
    </>
  )
}
