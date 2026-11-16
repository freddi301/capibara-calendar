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
  'list>view': enter('view'),
  'view>list': leave('view'),
  'list>calendars': enter('calendars'),
  'calendars>list': leave('calendars'),
  'list>filters': enter('filters'),
  'filters>list': leave('filters'),
  'export>filters': enter('filters'),
  'filters>export': leave('filters'),
  'list>event': enter('event'),
  'event>list': leave('event'),
  'list>detail': enter('event'),
  'detail>list': leave('event'),
  'detail>event': enter('event'),
  'event>detail': leave('event'),
  'calendars>import': enter('import'),
  'import>calendars': leave('import'),
  'import>filters': enter('filters'),
  'filters>import': leave('filters'),
  'calendars>export': enter('export'),
  'export>calendars': leave('export'),
  'calendars>calendar': enter('calendar'),
  'calendar>calendars': leave('calendar'),
}

export function motionBetween(from: Route, to: Route): Motion | undefined {
  return motions[`${from.screen}>${to.screen}`]
}
