import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import DayList from '@/components/DayList'
import MonthTable from '@/components/MonthTable'
import WeekStrip from '@/components/WeekStrip'
import { loadDaysMode, otherMode, saveDaysMode } from '@/lib/days-mode'
import type { ListScreenProps } from '@/lib/layout'
import { monthPages, weekPages } from '@/lib/week'

export default function DaysScreen(props: ListScreenProps) {
  const { t } = useLingui()
  const [mode, setMode] = useState(loadDaysMode)
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
          const next = otherMode(mode)
          setMode(next)
          saveDaysMode(next)
        },
      }}
    />
  )
}
