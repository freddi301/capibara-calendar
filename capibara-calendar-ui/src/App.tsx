import { useState } from 'react'
import type { CalendarEvent } from '@/lib/caldav'
import CreateEditEventScreen from '@/screens/CreateEditEventScreen'
import EventListScreen from '@/screens/EventListScreen'
import SettingsScreen from '@/screens/SettingsScreen'

type Route =
  { screen: 'list' } | { screen: 'event'; event?: CalendarEvent } | { screen: 'settings' }

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
        onClose={() => {
          setRoute({ screen: 'list' })
        }}
      />
    )
  }
  return (
    <EventListScreen
      onCreate={() => {
        setRoute({ screen: 'event' })
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
