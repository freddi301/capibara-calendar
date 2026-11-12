import ICAL from 'ical.js'
import {
  localDateTime,
  type Day,
  type LocalDateTime,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from '../calendar-api'

const dayCodes: Record<Day, string> = {
  mo: 'MO',
  tu: 'TU',
  we: 'WE',
  th: 'TH',
  fr: 'FR',
  sa: 'SA',
  su: 'SU',
}

const dayOfCode = (code: string) => code.toLowerCase() as Day

const byParts = [
  ['byMonthDay', 'BYMONTHDAY'],
  ['byYearDay', 'BYYEARDAY'],
  ['byWeekNo', 'BYWEEKNO'],
  ['byHour', 'BYHOUR'],
  ['byMinute', 'BYMINUTE'],
  ['bySecond', 'BYSECOND'],
  ['bySetPosition', 'BYSETPOS'],
] as const

export function toIcalRecur(rule: RecurrenceRule) {
  const parts = [`FREQ=${rule.frequency.toUpperCase()}`]
  if (rule.interval && rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`)
  if (rule.count) parts.push(`COUNT=${rule.count}`)
  if (rule.until) {
    parts.push(`UNTIL=${ICAL.Time.fromDateTimeString(rule.until).toICALString()}`)
  }
  if (rule.firstDayOfWeek) parts.push(`WKST=${dayCodes[rule.firstDayOfWeek]}`)
  if (rule.byDay?.length) {
    parts.push(
      `BYDAY=${rule.byDay.map(({ day, nthOfPeriod }) => `${nthOfPeriod ?? ''}${dayCodes[day]}`).join(',')}`,
    )
  }
  if (rule.byMonth?.length) {
    parts.push(`BYMONTH=${rule.byMonth.map((month) => Number.parseInt(month, 10)).join(',')}`)
  }
  for (const [name, part] of byParts) {
    const values = rule[name]
    if (values?.length) parts.push(`${part}=${values.join(',')}`)
  }
  return ICAL.Recur.fromString(parts.join(';'))
}

export function ruleOfRecur(recur: ICAL.Recur): RecurrenceRule {
  const parts = recur.parts as Record<string, (string | number)[] | undefined>
  const rule: RecurrenceRule = { frequency: recur.freq.toLowerCase() as RecurrenceFrequency }
  if (recur.interval > 1) rule.interval = recur.interval
  if (recur.count) rule.count = recur.count
  if (recur.until) {
    const until = recur.until
    rule.until = localDateTime(
      until.isDate ? `${until.toString()}T23:59:59` : until.toString().slice(0, 19),
    )
  }
  const days = parts.BYDAY
  if (days?.length) {
    rule.byDay = days.map((code) => {
      const match = /^([+-]?\d+)?([A-Z]{2})$/.exec(String(code))
      return {
        day: dayOfCode(match?.[2] ?? String(code)),
        ...(match?.[1] ? { nthOfPeriod: Number(match[1]) } : {}),
      }
    })
  }
  if (parts.BYMONTH?.length) rule.byMonth = parts.BYMONTH.map(String)
  for (const [name, part] of byParts) {
    const values = parts[part]
    if (values?.length) rule[name] = values.map(Number)
  }
  const wkstCode = /WKST=([A-Z]{2})/.exec(recur.toString())?.[1]
  if (wkstCode && wkstCode !== 'MO') rule.firstDayOfWeek = dayOfCode(wkstCode)
  return rule
}

const maxOccurrences = 10000

export function* occurrenceStarts(start: LocalDateTime, rules: RecurrenceRule[]) {
  const dtstart = ICAL.Time.fromDateTimeString(start)
  const iterators = rules.map((rule) => toIcalRecur(rule).iterator(dtstart))
  const heads: (ICAL.Time | undefined)[] = iterators.map((iterator) => iterator.next())
  const seen = new Set<string>()
  for (let count = 0; count < maxOccurrences; count++) {
    let best: ICAL.Time | undefined
    let bestIndex = -1
    heads.forEach((head, index) => {
      if (head && (!best || head.compare(best) < 0)) {
        best = head
        bestIndex = index
      }
    })
    if (!best) return
    const local = localDateTime(best.toString().slice(0, 19))
    heads[bestIndex] = iterators[bestIndex].next()
    if (seen.has(local)) continue
    seen.add(local)
    yield local
  }
}

const simpleFrequencies: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'yearly']
const simpleParts = ['frequency', 'interval', 'count', 'until', 'byDay']

export function isSimpleRule(rule: RecurrenceRule) {
  const isWeeklyDays =
    !rule.byDay ||
    (rule.frequency === 'weekly' &&
      rule.byDay.every(({ nthOfPeriod }) => nthOfPeriod === undefined))
  return (
    simpleFrequencies.includes(rule.frequency) &&
    isWeeklyDays &&
    Object.keys(rule).every((key) => simpleParts.includes(key)) &&
    !(rule.count && rule.until)
  )
}
