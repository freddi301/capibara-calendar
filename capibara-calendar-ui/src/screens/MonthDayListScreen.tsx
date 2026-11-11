import DayList from '@/components/DayList'
import MonthTable from '@/components/MonthTable'
import { monthRange } from '@/lib/week'
import type { ListScreenProps } from '@/lib/layout'

export default function MonthDayListScreen(props: ListScreenProps) {
  return <DayList {...props} dayPicker={MonthTable} rangeAround={monthRange} />
}
