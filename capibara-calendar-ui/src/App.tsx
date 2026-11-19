import { Trans } from '@lingui/react/macro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type ComponentType, type RefObject } from 'react'
import { getApi, hasSources, onSourcesChanged, resetApi } from '@/api'
import { ApiError, type CalendarEvent, type EventRef } from '@/api/calendar-api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { eventQueryKey, refreshEvents } from '@/lib/event-chunks'
import { useCalendars } from '@/lib/use-calendars'
import { useStored } from '@/lib/use-stored'
import { forgetTimelineScroll } from '@/lib/kept-scroll'
import { forgetPasswordOf, primaryConnectionId } from '@/lib/connection'
import EditScopeDialog from '@/components/EditScopeDialog'
import type { Layout, ListScreenProps } from '@/lib/layout'
import {
  fromExport,
  fromImport,
  dayOf,
  loadRouteState,
  saveRouteState,
  withDay,
  type Route,
} from '@/lib/route-state'
import { forgetPersistedQueries } from '@/lib/query-persist'
import { setUnauthorizedHandler } from '@/lib/unauthorized'
import { onDuplicateRequested } from '@/lib/event-actions'
import { isWebxdc } from '@/lib/webxdc'
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
import ExportScreen from '@/screens/ExportScreen'
import ImportScreen from '@/screens/ImportScreen'
import EventDetailScreen from '@/screens/EventDetailScreen'
import CalendarsScreen from '@/screens/CalendarsScreen'
import FiltersScreen from '@/screens/FiltersScreen'
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
  timelineDay: TimelineDayScreen,
  timelineWeek: TimelineWeekScreen,
  timelineMonth: TimelineMonthScreen,
}

const changesWaitMs = 200

export default function App() {
  const backHandler = useRef<BackHandler | undefined>(undefined)
  return (
    <BackHandlerContext value={backHandler}>
      <Screens backHandler={backHandler} />
    </BackHandlerContext>
  )
}

function Leave({ onLeave }: { onLeave: () => void }) {
  useEffect(() => {
    onLeave()
  }, [onLeave])
  return null
}

function useRouteEvent(
  event: CalendarEvent | undefined,
  address: EventRef | undefined,
  isLooking: boolean,
) {
  const isLive = isLooking
  const ref = isLive ? (event?.ref ?? address) : address
  const query = useQuery({
    queryKey: eventQueryKey(ref),
    queryFn: () => getApi().getEvent(ref as EventRef),
    enabled: isLive ? !!ref : !event && !!ref,
    initialData: isLive ? event : undefined,
    refetchOnWindowFocus: false,
    retry: isLive && !event && isWebxdc() ? 8 : false,
    retryDelay: 750,
  })
  if (!isLive) return { event: event ?? query.data, isError: query.isError }
  const shown = query.data ?? event
  const isGone = query.error instanceof ApiError && query.error.kind === 'notFound'
  return { event: shown, isError: query.isError && (isGone || !shown) }
}

function Screens({ backHandler }: { backHandler: RefObject<BackHandler | undefined> }) {
  const [{ route, layout }, setState] = useState(loadRouteState)
  const [isConnected, setConnected] = useState(hasSources)
  const [isRejected, setRejected] = useState(false)
  const [isNoticed, setNotice] = useState(false)
  const queryClient = useQueryClient()
  const calendars = useCalendars()
  useEffect(() => {
    let timer: number | undefined
    const stop = onSourcesChanged(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['calendars'] })
        void queryClient.invalidateQueries({ queryKey: ['contacts'] })
        void queryClient.invalidateQueries({ queryKey: ['event'] })
        void refreshEvents(queryClient)
      }, changesWaitMs)
    })
    return () => {
      window.clearTimeout(timer)
      stop()
    }
  }, [queryClient])
  useEffect(() => {
    setUnauthorizedHandler((id) => {
      forgetPasswordOf(id ?? primaryConnectionId)
      resetApi()
      queryClient.clear()
      void forgetPersistedQueries()
      setRejected(true)
      const hasAny = hasSources()
      setConnected(hasAny)
      if (hasAny) setNotice(true)
    })
    return () => {
      setUnauthorizedHandler(undefined)
    }
  }, [queryClient])
  const [asked, setAsked] = useState<CalendarEvent>()
  const isEventRoute = route.screen === 'detail' || route.screen === 'event'
  const routeEvent = useRouteEvent(
    isEventRoute ? route.event : undefined,
    isEventRoute ? route.ref : undefined,
    route.screen === 'detail',
  )
  const routeNow = useRef(route)
  const currentDate = useRef(dayOf(route))
  const timeZone = useStored((stored) => stored.settings.timeZone)
  const zoneSeen = useRef(timeZone)
  useEffect(() => {
    if (zoneSeen.current === timeZone) return
    zoneSeen.current = timeZone
    currentDate.current = undefined // today is another day in another time zone
  }, [timeZone])
  useEffect(() => {
    routeNow.current = route
  })
  const isPopping = useRef(false)
  const ignoredPops = useRef(0)
  const setRoute = (to: Route) => {
    const next = withDay(to, currentDate.current)
    if (isPopping.current) {
      if (overlayDepth(next) > 0 && overlayDepth(next) === overlayDepth(route)) {
        history.pushState({ overlay: true }, '')
      }
    } else {
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
          const under = withDay(routeUnder(current), currentDate.current)
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
    if (next !== layout) forgetTimelineScroll()
    setState((state) => ({ ...state, layout: next }))
  }
  const setListDate = useCallback((date: string) => {
    if (routeNow.current.screen === 'list') currentDate.current = date
    setState((state) =>
      state.route.screen === 'list' && state.route.date !== date
        ? { ...state, route: { screen: 'list', date } }
        : state,
    )
  }, [])

  useEffect(() =>
    onDuplicateRequested((event) => {
      setRoute({ screen: 'event', copy: event, date: event.start.slice(0, 10) })
    }),
  )

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
        onConnectionChange={() => {
          const hasAny = hasSources()
          setConnected(hasAny)
          setRejected(false)
          if (hasAny && !isConnected) toList()
        }}
      />
    )
  }
  if (route.screen === 'calendars') {
    return (
      <CalendarsScreen
        onClose={toList}
        onEditCalendar={(calendar) => {
          setRoute({ screen: 'calendar', calendar })
        }}
        onExport={() => {
          setRoute({ screen: 'export' })
        }}
        onImport={() => {
          setRoute({ screen: 'import' })
        }}
      />
    )
  }
  if (route.screen === 'import') {
    return (
      <ImportScreen
        onClose={() => {
          setRoute({ screen: 'calendars' })
        }}
        onOpenFilters={() => {
          setRoute({ screen: 'filters', from: fromImport })
        }}
      />
    )
  }
  if (route.screen === 'export') {
    return (
      <ExportScreen
        onClose={() => {
          setRoute({ screen: 'calendars' })
        }}
        onOpenFilters={() => {
          setRoute({ screen: 'filters', from: fromExport })
        }}
      />
    )
  }
  if (route.screen === 'filters') {
    const { from } = route
    return (
      <FiltersScreen
        onClose={() => {
          if (from === fromExport) setRoute({ screen: 'export' })
          else if (from === fromImport) setRoute({ screen: 'import' })
          else toList()
        }}
      />
    )
  }
  if (route.screen === 'calendar') {
    return (
      <CalendarEditScreen
        calendar={route.calendar}
        onClose={() => {
          setRoute({ screen: 'calendars' })
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
  if (route.screen === 'detail') {
    const { date } = route
    const event = routeEvent.event
    if (routeEvent.isError) return <Leave onLeave={toList} />
    if (!event) return null
    return (
      <>
        <EventDetailScreen
          event={event}
          onEdit={() => {
            if (event.recurrenceRules.length > 0) setAsked(event)
            else setRoute({ screen: 'event', event, from: event, date })
          }}
          onClose={() => {
            setRoute({ screen: 'list', date })
          }}
        />
        <EditScopeDialog
          event={asked}
          onChoose={(chosen, scope) => {
            setAsked(undefined)
            setRoute({ screen: 'event', event: chosen, scope, from: event, date })
          }}
          onCancel={() => {
            setAsked(undefined)
          }}
        />
      </>
    )
  }
  if (route.screen === 'event') {
    const { date } = route
    const event = routeEvent.event
    if (routeEvent.isError) return <Leave onLeave={toList} />
    if (route.ref && !event) return null
    return (
      <CreateEditEventScreen
        key={`${route.scope ?? ''}${route.copy ? 'copy' : ''}`}
        event={event}
        copyOf={route.copy}
        scope={route.scope}
        date={date}
        onDiscard={
          event
            ? () => {
                setRoute({ screen: 'detail', event: route.from ?? event, date })
              }
            : undefined
        }
        onSaved={
          event
            ? (saved) => {
                setRoute({ screen: 'detail', event: saved, date })
              }
            : undefined
        }
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
          if (!hasSources()) setRoute({ screen: 'settings' })
          else if (calendars.isSuccess && !calendars.data.some(({ rights }) => rights.create)) {
            setRoute({ screen: 'calendars' })
          } else setRoute({ screen: 'event', date })
        }}
        onOpenSettings={() => {
          setRoute({ screen: 'settings' })
        }}
        onOpenCalendars={() => {
          setRoute({ screen: 'calendars' })
        }}
        onOpenFilters={() => {
          setRoute({ screen: 'filters' })
        }}
        onEdit={(event) => {
          setRoute({ screen: 'detail', event: event.source, date: route.date })
        }}
        onOpenLayouts={(date) => {
          setRoute({ screen: 'layouts', date })
        }}
        onOpenView={(date) => {
          setRoute({ screen: 'view', date })
        }}
      />
      <AlertDialog open={isNoticed} onOpenChange={setNotice}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>A server did not accept the password</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>Its calendars are hidden until you enter the password again.</Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Later</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRoute({ screen: 'settings' })
              }}
            >
              <Trans>Open settings</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
