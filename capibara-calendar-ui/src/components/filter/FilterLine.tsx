import { Plural, Trans } from '@lingui/react/macro'
import { countRules } from '@/lib/event-filter'
import { useStored } from '@/lib/use-stored'

/** The filter in a few words: that it is on and how many rules it has, or that there is none. */
export default function FilterLine() {
  const rules = countRules(useStored((stored) => stored.eventFilter))
  if (rules > 0) return <Plural value={rules} one="Filter on: # rule" other="Filter on: # rules" />
  return (
    <span className="text-muted-foreground">
      <Trans>No filter: all events</Trans>
    </span>
  )
}
