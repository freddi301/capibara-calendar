import { plural, t } from '@lingui/core/macro'
import type { EventFormValues } from './event-schema'
import { weekdayCodes } from './event-schema'
import { formatDate, formatWeekday } from './format'

type RepeatFields = Pick<
  EventFormValues,
  'repeat' | 'repeatInterval' | 'repeatDays' | 'repeatEnds' | 'repeatUntil' | 'repeatCount'
>

export function repeatSummary(event: RepeatFields, locale: string, weekStart = 1) {
  const { repeat } = event
  if (!repeat) return ''
  if (repeat === 'custom') return t`Repeats, in a way that is kept as it is`
  const every = Number(event.repeatInterval) || 1
  const head = {
    DAILY: plural(every, { one: 'Every day', other: 'Every # days' }),
    WEEKLY: plural(every, { one: 'Every week', other: 'Every # weeks' }),
    MONTHLY: plural(every, { one: 'Every month', other: 'Every # months' }),
    YEARLY: plural(every, { one: 'Every year', other: 'Every # years' }),
  }[repeat]
  const parts = [head]
  if (repeat === 'WEEKLY' && event.repeatDays?.length) {
    const chosen = weekdayCodes
      .map((code, index) => ({ code, index }))
      .filter(({ code }) => event.repeatDays?.includes(code))
      .sort((a, b) => ((a.index + 8 - weekStart) % 7) - ((b.index + 8 - weekStart) % 7))
    parts.push(
      chosen
        .map(({ index }) =>
          formatWeekday(Temporal.PlainDate.from({ year: 2024, month: 1, day: index + 1 }), locale),
        )
        .join(', '),
    )
  }
  if (event.repeatEnds === 'on' && event.repeatUntil) {
    const day = formatDate(event.repeatUntil, locale)
    parts.push(t`until ${day}`)
  } else if (event.repeatEnds === 'after' && event.repeatCount) {
    const count = Number(event.repeatCount)
    parts.push(plural(count, { one: '# time', other: '# times' }))
  }
  return parts.join(' · ')
}
