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

export function usesTwelveHours(locale: string) {
  return formatter(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true
}

export function formatTime(time: string, locale: string) {
  return formatter(locale, {
    hour: usesTwelveHours(locale) ? 'numeric' : '2-digit',
    minute: '2-digit',
  }).format(Temporal.PlainTime.from(time) as unknown as Date)
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

export function formatFullDate(day: Temporal.PlainDate, locale: string) {
  return formatDay(day, locale, { dateStyle: 'full' })
}

export function formatTimeRange(start: string, end: string, locale: string) {
  if (start && end) return `${formatTime(start, locale)}–${formatTime(end, locale)}`
  return start || end ? formatTime(start || end, locale) : ''
}
