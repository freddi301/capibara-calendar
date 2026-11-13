import { useLingui } from '@lingui/react/macro'
import { useMemo } from 'react'
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxItem,
  ComboboxScroll,
  ComboboxTrigger,
  ComboboxValue,
} from '@/components/ui/combobox'
import { timeZones } from '@/lib/settings'
import { matchesZone, zoneGroups, type ZoneGroup, type ZoneOption } from '@/lib/zone-choice'

type ZoneSelectProps = {
  label: string
  value: string
  pinned: ZoneOption[]
  onChange: (value: string) => void
}

function OptionText({ option, isInTrigger }: { option: ZoneOption; isInTrigger?: boolean }) {
  const hint = isInTrigger && !option.hintInTrigger ? undefined : option.hint
  return (
    <span className="flex min-w-0 flex-col items-start">
      <span className="truncate">
        {isInTrigger ? (option.title ?? option.label) : option.label}
        {option.hintInTrigger && option.hint && (
          <span className="text-muted-foreground"> {option.hint}</span>
        )}
      </span>
      {hint && !option.hintInTrigger && (
        <span className="text-left text-sm whitespace-normal text-muted-foreground">{hint}</span>
      )}
    </span>
  )
}

/** A select of time zones that can be searched, with the zones grouped by their prefix. */
export default function ZoneSelect({ label, value, pinned, onChange }: ZoneSelectProps) {
  const { t } = useLingui()
  const groups = useMemo(() => zoneGroups(pinned, timeZones, t`Other`), [pinned, t])
  const selected = groups.flatMap(({ items }) => items).find((option) => option.value === value)

  return (
    <Combobox
      items={groups}
      value={selected ?? null}
      onValueChange={(option: ZoneOption | null) => {
        if (option) onChange(option.value)
      }}
      isItemEqualToValue={(option: ZoneOption, chosen: ZoneOption) => option.value === chosen.value}
      itemToStringLabel={(option: ZoneOption) => option.label}
      filter={matchesZone}
      autoHighlight
    >
      <ComboboxTrigger aria-label={label}>
        <ComboboxValue>
          {(option: ZoneOption | null) =>
            option ? <OptionText option={option} isInTrigger /> : value
          }
        </ComboboxValue>
      </ComboboxTrigger>
      <ComboboxContent placeholder={t`Search a time zone`}>
        <ComboboxEmpty>{t`No time zone found`}</ComboboxEmpty>
        <ComboboxScroll>
          {(group: ZoneGroup) => (
            <ComboboxGroup key={group.value} items={group.items}>
              {group.value && <ComboboxGroupLabel>{group.value}</ComboboxGroupLabel>}
              <ComboboxCollection>
                {(option: ZoneOption) => (
                  <ComboboxItem key={option.value} value={option}>
                    <OptionText option={option} />
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxScroll>
      </ComboboxContent>
    </Combobox>
  )
}
