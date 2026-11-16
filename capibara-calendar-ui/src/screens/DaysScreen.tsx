import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import DayList from '@/components/DayList'
import MonthTable from '@/components/MonthTable'
import WeekStrip from '@/components/WeekStrip'
import type { ListScreenProps } from '@/lib/layout'
import { getStored, setStored, type Stored } from '@/lib/use-stored'
import { withViewTransition } from '@/lib/view-transition'
import { monthPages, weekPages } from '@/lib/week'

type DaysMode = Stored['daysMode']

export default function DaysScreen(props: ListScreenProps) {
  const { t } = useLingui()
  const [mode, setMode] = useState(() => getStored().daysMode)
  const isMonth = mode === 'month'
  return (
    <DayList
      {...props}
      dayPicker={isMonth ? MonthTable : WeekStrip}
      pagesAround={isMonth ? monthPages : weekPages}
      pickerToggle={{
        isExpanded: isMonth,
        label: isMonth ? t`Show the week` : t`Show the month`,
        onToggle: () => {
          const next: DaysMode = isMonth ? 'week' : 'month'
          setStored({ daysMode: next })
          withViewTransition(
            () => {
              setMode(next)
            },
            { kind: 'toggle' },
          )
        },
      }}
    />
  )
}
