import DayList from '@/components/DayList'
import WeekStrip from '@/components/WeekStrip'
import type { ListScreenProps } from '@/lib/layout'

export default function WeekDayListScreen(props: ListScreenProps) {
  return <DayList {...props} dayPicker={WeekStrip} />
}
