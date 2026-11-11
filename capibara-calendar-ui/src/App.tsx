import { useCallback, useEffect, useState, type ComponentType } from 'react'
import type { Layout, ListScreenProps } from '@/lib/layout'
import { loadRouteState, saveRouteState, type Route } from '@/lib/route-state'
import AgendaScreen from '@/screens/AgendaScreen'
import CreateEditEventScreen from '@/screens/CreateEditEventScreen'
import FilterScreen from '@/screens/FilterScreen'
import LayoutSwitcherScreen from '@/screens/LayoutSwitcherScreen'
import MonthDayListScreen from '@/screens/MonthDayListScreen'
import SettingsScreen from '@/screens/SettingsScreen'
import WeekRowsScreen from '@/screens/WeekRowsScreen'
import WeekDayListScreen from '@/screens/WeekDayListScreen'

const listScreens: Record<Layout, ComponentType<ListScreenProps>> = {
  week: WeekDayListScreen,
  weekRows: WeekRowsScreen,
  month: MonthDayListScreen,
  agenda: AgendaScreen,
}

export default function App() {
  const [{ route, layout }, setState] = useState(loadRouteState)
  const setRoute = useCallback((next: Route) => {
    setState((state) => ({ ...state, route: next }))
  }, [])
  const setLayout = (next: Layout) => {
    setState((state) => ({ ...state, layout: next }))
  }
  const setListDate = useCallback((date: string) => {
    setState((state) =>
      state.route.screen === 'list' && state.route.date !== date
        ? { ...state, route: { screen: 'list', date } }
        : state,
    )
  }, [])

  useEffect(() => {
    saveRouteState({ route, layout })
  }, [route, layout])

  const toList = () => {
    setRoute({ screen: 'list' })
  }

  if (route.screen === 'settings') return <SettingsScreen onClose={toList} />
  if (route.screen === 'filter') return <FilterScreen onClose={toList} />
  if (route.screen === 'layouts') {
    const { date } = route
    return (
      <LayoutSwitcherScreen
        layout={layout}
        onChoose={(chosen) => {
          setLayout(chosen)
          setRoute({ screen: 'list', date })
        }}
        onClose={() => {
          setRoute({ screen: 'list', date })
        }}
      />
    )
  }
  if (route.screen === 'event') {
    return <CreateEditEventScreen event={route.event} date={route.date} onClose={toList} />
  }
  const List = listScreens[layout]
  return (
    <List
      date={route.date}
      onDateChange={setListDate}
      onCreate={(date) => {
        setRoute({ screen: 'event', date })
      }}
      onOpenSettings={() => {
        setRoute({ screen: 'settings' })
      }}
      onOpenFilter={() => {
        setRoute({ screen: 'filter' })
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
