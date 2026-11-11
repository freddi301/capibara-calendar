import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { loadConnection } from '@/lib/connection'
import EditScopeDialog from '@/components/EditScopeDialog'
import type { CalendarEvent } from '@/lib/caldav'
import type { Layout, ListScreenProps } from '@/lib/layout'
import { loadRouteState, saveRouteState, type Route } from '@/lib/route-state'
import AgendaScreen from '@/screens/AgendaScreen'
import CalendarEditScreen from '@/screens/CalendarEditScreen'
import CreateEditEventScreen from '@/screens/CreateEditEventScreen'
import DaysScreen from '@/screens/DaysScreen'
import FilterScreen from '@/screens/FilterScreen'
import LayoutSwitcherScreen from '@/screens/LayoutSwitcherScreen'
import SettingsScreen from '@/screens/SettingsScreen'
import WeekRowsScreen from '@/screens/WeekRowsScreen'

const listScreens: Record<Layout, ComponentType<ListScreenProps>> = {
  agenda: AgendaScreen,
  weekRows: WeekRowsScreen,
  days: DaysScreen,
}

export default function App() {
  const [{ route, layout }, setState] = useState(loadRouteState)
  const [isConnected, setConnected] = useState(() => loadConnection() !== undefined)
  // An event that repeats, that was opened: which of its events to edit is asked first.
  const [asked, setAsked] = useState<CalendarEvent>()
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

  if (!isConnected || route.screen === 'settings') {
    return (
      <SettingsScreen
        onClose={isConnected ? toList : undefined}
        onConnectionChange={(connected) => {
          setConnected(connected)
          if (connected && !isConnected) toList()
        }}
      />
    )
  }
  if (route.screen === 'filter') {
    return (
      <FilterScreen
        onClose={toList}
        onEditCalendar={(calendar) => {
          setRoute({ screen: 'calendar', calendar })
        }}
      />
    )
  }
  if (route.screen === 'calendar') {
    return (
      <CalendarEditScreen
        calendar={route.calendar}
        onClose={() => {
          setRoute({ screen: 'filter' })
        }}
      />
    )
  }
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
    return (
      <CreateEditEventScreen
        event={route.event}
        scope={route.scope}
        date={route.date}
        onClose={toList}
      />
    )
  }
  const List = listScreens[layout]
  return (
    <>
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
          if (event.isRecurring) setAsked(event)
          else setRoute({ screen: 'event', event })
        }}
        onOpenLayouts={(date) => {
          setRoute({ screen: 'layouts', date })
        }}
      />
      <EditScopeDialog
        event={asked}
        onChoose={(event, scope) => {
          setAsked(undefined)
          setRoute({ screen: 'event', event, scope })
        }}
        onCancel={() => {
          setAsked(undefined)
        }}
      />
    </>
  )
}
