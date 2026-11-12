import { expect, it } from 'vitest'
import { agendaScroll, keepScroll, keptScroll, timelineScroll } from '../lib/kept-scroll'

it('gives back where a layout was only for the day that it is to show', () => {
  keepScroll(agendaScroll, { date: '2026-11-16', start: '2026-11-12', scrollTop: 500 })

  expect(keptScroll(agendaScroll, '2026-11-16')).toMatchObject({ scrollTop: 500 })
  expect(keptScroll(agendaScroll, '2026-11-17')).toBeUndefined() // another day was chosen meanwhile
  expect(keptScroll(agendaScroll, undefined)).toBeUndefined()
})

it('keeps each layout apart, and the last place of each', () => {
  keepScroll(timelineScroll('day'), { date: '2026-11-12', fraction: 0.25 })
  keepScroll(timelineScroll('week'), { date: '2026-11-12', fraction: 0.5 })
  keepScroll(timelineScroll('day'), { date: '2026-11-13', fraction: 0.75 })

  expect(keptScroll(timelineScroll('week'), '2026-11-12')).toMatchObject({ fraction: 0.5 })
  expect(keptScroll(timelineScroll('day'), '2026-11-12')).toBeUndefined()
  expect(keptScroll(timelineScroll('day'), '2026-11-13')).toMatchObject({ fraction: 0.75 })
})
