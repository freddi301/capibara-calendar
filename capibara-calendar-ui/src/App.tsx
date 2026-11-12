import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type ComponentType, type RefObject } from 'react'
import { forgetPassword, loadConnection } from '@/lib/connection'
import EditScopeDialog from '@/components/EditScopeDialog'
import { resetConnection, type CalendarEvent } from '@/lib/caldav'
import type { Layout, ListScreenProps } from '@/lib/layout'
import { loadRouteState, saveRouteState, type Route } from '@/lib/route-state'
import { forgetPersistedQueries } from '@/lib/query-persist'
import { setUnauthorizedHandler } from '@/lib/unauthorized'
import {
  BackHandlerContext,
  isEscapeForScreen,
  keyEvent,
  overlayDepth,
  popEvent,
  routeUnder,
  type BackHandler,
} from '@/lib/overlay-history'
import { motionBetween } from '@/lib/route-motion'
import { withViewTransition } from '@/lib/view-transition'
import AgendaScreen from '@/screens/AgendaScreen'
import CalendarEditScreen from '@/screens/CalendarEditScreen'
import CreateEditEventScreen from '@/screens/CreateEditEventScreen'
import DaysScreen from '@/screens/DaysScreen'
import FilterScreen from '@/screens/FilterScreen'
import LayoutSwitcherScreen from '@/screens/LayoutSwitcherScreen'
import SettingsScreen from '@/screens/SettingsScreen'
import {
  TimelineDayScreen,
  TimelineMonthScreen,
  TimelineWeekScreen,
} from '@/screens/TimelineScreen'
import ViewScreen from '@/screens/ViewScreen'
import WeekRowsScreen from '@/screens/WeekRowsScreen'

const listScreens: Record<Layout, ComponentType<ListScreenProps>> = {
  agenda: AgendaScreen,
  weekRows: WeekRowsScreen,
  days: DaysScreen,
  timelineDay: TimelineDayScreen,
  timelineWeek: TimelineWeekScreen,
  timelineMonth: TimelineMonthScreen,
}

export default function App() {
  const backHandler = useRef<BackHandler | undefined>(undefined)
  return (
    <BackHandlerContext value={backHandler}>
      <Screens backHandler={backHandler} />
    </BackHandlerContext>
  )
}

function Screens({ backHandler }: { backHandler: RefObject<BackHandler | undefined> }) {
  const [{ route, layout }, setState] = useState(loadRouteState)
  const [isConnected, setConnected] = useState(() => loadConnection() !== undefined)
  const [isRejected, setRejected] = useState(false)
  const queryClient = useQueryClient()
  useEffect(() => {
    setUnauthorizedHandler(() => {
      forgetPassword()
      resetConnection()
      queryClient.clear()
      void forgetPersistedQueries()
      setRejected(true)
      setConnected(false)
    })
    return () => {
      setUnauthorizedHandler(undefined)
    }
  }, [queryClient])
  const [asked, setAsked] = useState<CalendarEvent>()
  const routeNow = useRef(route)
  useEffect(() => {
    routeNow.current = route
  })
  const isPopping = useRef(false)
  const ignoredPops = useRef(0)
  const setRoute = (next: Route) => {
    if (!isPopping.current) {
      const depth = overlayDepth(next) - overlayDepth(route)
      if (depth > 0) {
        for (let level = 0; level < depth; level++) history.pushState({ overlay: true }, '')
      } else if (depth < 0) {
        ignoredPops.current += 1
        history.go(depth)
      }
    }
    withViewTransition(
      () => {
        setState((state) => ({ ...state, route: next }))
      },
      motionBetween(route, next),
    )
  }
  useEffect(() => {
    const depth = overlayDepth(routeNow.current)
    if (depth > 0) history.replaceState({ base: true }, '')
    for (let level = 0; level < depth; level++) history.pushState({ overlay: true }, '')

    const onPop = () => {
      if (ignoredPops.current > 0) {
        ignoredPops.current -= 1
        return
      }
      const current = routeNow.current
      if (overlayDepth(current) === 0) return
      isPopping.current = true
      try {
        if (backHandler.current) {
          if (!backHandler.current()) history.pushState({ overlay: true }, '')
        } else {
          const under = routeUnder(current)
          withViewTransition(
            () => {
              setState((state) => ({ ...state, route: under }))
            },
            motionBetween(current, under),
          )
        }
      } finally {
        isPopping.current = false
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (!isEscapeForScreen(event) || overlayDepth(routeNow.current) === 0) return
      history.back()
    }
    window.addEventListener(popEvent, onPop)
    window.addEventListener(keyEvent, onKey, true)
    return () => {
      window.removeEventListener(popEvent, onPop)
      window.removeEventListener(keyEvent, onKey, true)
    }
  }, [backHandler])

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
        key={`${isConnected}${isRejected}`}
        isPasswordRejected={isRejected}
        onClose={isConnected ? toList : undefined}
        onConnectionChange={(connected) => {
          setConnected(connected)
          setRejected(false)
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
  if (route.screen === 'view') {
    const { date } = route
    return (
      <ViewScreen
        onClose={() => {
          setRoute({ screen: 'list', date })
        }}
      />
    )
  }
  if (route.screen === 'event') {
    const { event, date, readOnly } = route
    return (
      <>
        <CreateEditEventScreen
          key={`${route.scope ?? ''} ${readOnly ?? false}`}
          event={event}
          scope={route.scope}
          date={date}
          readOnly={readOnly}
          onEdit={() => {
            if (event?.isRecurring) setAsked(event)
            else setRoute({ screen: 'event', event, date })
          }}
          onClose={toList}
        />
        <EditScopeDialog
          event={asked}
          onChoose={(chosen, scope) => {
            setAsked(undefined)
            setRoute({ screen: 'event', event: chosen, scope })
          }}
          onCancel={() => {
            setAsked(undefined)
          }}
        />
      </>
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
          setRoute({ screen: 'event', event, readOnly: true })
        }}
        onOpenLayouts={(date) => {
          setRoute({ screen: 'layouts', date })
        }}
        onOpenView={(date) => {
          setRoute({ screen: 'view', date })
        }}
      />
    </>
  )
}
