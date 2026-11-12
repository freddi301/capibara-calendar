const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale} ${JSON.stringify(options)}`
  let found = formatters.get(key)
  if (!found) {
    found = new Intl.DateTimeFormat(locale, options)
    formatters.set(key, found)
  }
  return found
}

export function formatDay(
  day: Temporal.PlainDate,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  return formatter(locale, options).format(day as unknown as Date)
}

export const fullDateStyle: Intl.DateTimeFormatOptions = { dateStyle: 'full' }

export function formatDayParts(
  day: Temporal.PlainDate,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  const parts = formatter(locale, options).formatToParts(day as unknown as Date)
  const isKeyType = (type?: string) => type === 'day' || type === 'month'
  return parts.map(({ type, value }, index) => ({
    type,
    text: index === 0 ? capitalize(value, locale) : value,
    isKey:
      isKeyType(type) ||
      (type === 'literal' &&
        isKeyType(parts[index - 1]?.type) &&
        isKeyType(parts[index + 1]?.type)),
  }))
}

export function formatTimeParts(time: string, locale: string) {
  return formatter(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(Temporal.PlainTime.from(time) as unknown as Date)
    .map(({ type, value }) => ({ type, text: value }))
}

export function formatTime(time: string, locale: string) {
  return formatter(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    Temporal.PlainTime.from(time) as unknown as Date,
  )
}

export function formatDate(date: string, locale: string) {
  return formatDay(Temporal.PlainDate.from(date), locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function capitalize(text: string, locale: string) {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
}

export function formatWeekday(day: Temporal.PlainDate, locale: string) {
  return capitalize(formatDay(day, locale, { weekday: 'short' }), locale)
}

export function longestWeekday(locale: string) {
  return Math.max(
    ...Array.from({ length: 7 }, (_, index) =>
      formatDay(Temporal.PlainDate.from({ year: 2024, month: 1, day: index + 1 }), locale, {
        weekday: 'long',
      }),
    ).map((name) => name.length),
  )
}

export const pickerOverName = (nameChars: number) => ({
  left: `calc(-${nameChars}ch - 0.5rem)`,
  width: `calc(${nameChars}ch + 0.5rem + 2ch)`,
})

export function formatFullDate(day: Temporal.PlainDate, locale: string) {
  return formatDay(day, locale, { dateStyle: 'full' })
}

export function formatTimeRange(start: string, end: string, locale: string) {
  if (start && end) return `${formatTime(start, locale)}–${formatTime(end, locale)}`
  return start || end ? formatTime(start || end, locale) : ''
}
