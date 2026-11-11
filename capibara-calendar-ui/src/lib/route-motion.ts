import type { Route } from './route-state'
import type { Motion } from './view-transition'

type Screen = Route['screen']

const enter = (page: Screen): Motion => ({ kind: 'enter', page })
const leave = (page: Screen): Motion => ({ kind: 'leave', page })

const motions: Partial<Record<`${Screen}>${Screen}`, Motion>> = {
  'list>settings': enter('settings'),
  'settings>list': leave('settings'),
  'list>layouts': enter('layouts'),
  'layouts>list': leave('layouts'),
  'list>filter': enter('filter'),
  'filter>list': leave('filter'),
  'list>event': enter('event'),
  'event>list': leave('event'),
  'filter>calendar': enter('calendar'),
  'calendar>filter': leave('calendar'),
}

export function motionBetween(from: Route, to: Route): Motion | undefined {
  return motions[`${from.screen}>${to.screen}`]
}
