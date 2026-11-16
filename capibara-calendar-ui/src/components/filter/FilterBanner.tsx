import { Trans, useLingui } from '@lingui/react/macro'
import { ListFilter } from 'lucide-react'
import FilterLine from '@/components/filter/FilterLine'
import { Button } from '@/components/ui/button'
import { countRules } from '@/lib/event-filter'
import { useStored } from '@/lib/use-stored'

/** One line: says whether the filter is acting on what a screen is about to do, and leads to it. */
export default function FilterBanner({ onChange }: { onChange: () => void }) {
  const { t } = useLingui()
  const rules = countRules(useStored((stored) => stored.eventFilter))
  return (
    <section
      aria-label={t`Filter`}
      className="flex items-center gap-3 rounded-md border border-dashed border-border p-3"
    >
      <ListFilter className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <FilterLine />
      </p>
      <Button
        type="button"
        variant="link"
        className="h-auto shrink-0 p-0 text-base dark:text-sidebar-primary"
        aria-label={rules > 0 ? t`Change the filter` : t`Set a filter`}
        onClick={onChange}
      >
        {rules > 0 ? <Trans>Change</Trans> : <Trans>Set</Trans>}
      </Button>
    </section>
  )
}
