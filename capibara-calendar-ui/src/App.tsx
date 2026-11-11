import { useState, type ComponentType } from 'react'
import type { CalendarEvent } from '@/lib/caldav'
import { defaultLayout, type Layout, type ListScreenProps } from '@/lib/layout'
import AgendaScreen from '@/screens/AgendaScreen'
import CreateEditEventScreen from '@/screens/CreateEditEventScreen'
import LayoutSwitcherScreen from '@/screens/LayoutSwitcherScreen'
import MonthDayListScreen from '@/screens/MonthDayListScreen'
import SettingsScreen from '@/screens/SettingsScreen'
import WeekRowsScreen from '@/screens/WeekRowsScreen'
import WeekDayListScreen from '@/screens/WeekDayListScreen'

type Route =
  | { screen: 'list'; date?: string }
  | { screen: 'event'; event?: CalendarEvent; date?: string }
  | { screen: 'layouts'; date: string }
  | { screen: 'settings' }

const listScreens: Record<Layout, ComponentType<ListScreenProps>> = {
  week: WeekDayListScreen,
  weekRows: WeekRowsScreen,
  month: MonthDayListScreen,
  agenda: AgendaScreen,
}

export default function App() {
  const [route, setRoute] = useState<Route>({ screen: 'list' })
  const [layout, setLayout] = useState<Layout>(defaultLayout)

  if (route.screen === 'settings') {
    return (
      <SettingsScreen
        onClose={() => {
          setRoute({ screen: 'list' })
        }}
      />
    )
  }
  if (route.screen === 'layouts') {
    return (
      <LayoutSwitcherScreen
        layout={layout}
        onChoose={(chosen) => {
          setLayout(chosen)
          setRoute({ screen: 'list', date: route.date })
        }}
        onClose={() => {
          setRoute({ screen: 'list', date: route.date })
        }}
      />
    )
  }
  if (route.screen === 'event') {
    return (
      <CreateEditEventScreen
        event={route.event}
        date={route.date}
        onClose={() => {
          setRoute({ screen: 'list' })
        }}
      />
    )
  }
  const List = listScreens[layout]
  return (
    <List
      date={route.date}
      onCreate={(date) => {
        setRoute({ screen: 'event', date })
      }}
      onOpenSettings={() => {
        setRoute({ screen: 'settings' })
      }}
      onEdit={(event) => {
        setRoute({ screen: 'event', event })
      }}
      onOpenLayouts={(date) => {
        setRoute({ screen: 'layouts', date })
      }}
    />
  )
}
