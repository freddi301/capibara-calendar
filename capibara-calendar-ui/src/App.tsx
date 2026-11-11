import { useState } from 'react'
import type { CalendarEvent } from '@/lib/caldav'
import CreateEditEventScreen from '@/screens/CreateEditEventScreen'
import SettingsScreen from '@/screens/SettingsScreen'
import WeekDayListScreen from '@/screens/WeekDayListScreen'

type Route =
  | { screen: 'list' }
  | { screen: 'event'; event?: CalendarEvent; date?: string }
  | { screen: 'settings' }

export default function App() {
  const [route, setRoute] = useState<Route>({ screen: 'list' })

  if (route.screen === 'settings') {
    return (
      <SettingsScreen
        onClose={() => {
          setRoute({ screen: 'list' })
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
  return (
    <WeekDayListScreen
      onCreate={(date) => {
        setRoute({ screen: 'event', date })
      }}
      onOpenSettings={() => {
        setRoute({ screen: 'settings' })
      }}
      onEdit={(event) => {
        setRoute({ screen: 'event', event })
      }}
    />
  )
}
