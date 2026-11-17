import { groupBy, sortBy, uniqBy } from 'es-toolkit'

export const floatingChoice = 'floating'
export const systemChoice = 'system'
export const utcZone = 'UTC'

export type ZoneOption = {
  value: string
  label: string
  title?: string
  hint?: string
  hintInTrigger?: boolean
  search: string
}

export type ZoneGroup = { value: string; items: ZoneOption[] }

export const zoneName = (zone: string) => zone.slice(zone.lastIndexOf('/') + 1).replaceAll('_', ' ')

export function zoneOption(
  zone: string,
  extra: Partial<Pick<ZoneOption, 'label' | 'title' | 'hint' | 'hintInTrigger'>> = {},
): ZoneOption {
  const readable = zone.replaceAll('_', ' ')
  const label = extra.label ?? zoneName(zone)
  return {
    value: zone,
    ...extra,
    label,
    search: `${zone} ${readable} ${label} ${extra.hint ?? ''}`,
  }
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export const matchesZone = (option: ZoneOption, query: string) =>
  fold(option.search).includes(fold(query.trim()))

const prefixOf = (zone: string) => (zone.includes('/') ? zone.slice(0, zone.indexOf('/')) : '')

export function zoneGroups(pinned: ZoneOption[], zones: string[], otherName: string): ZoneGroup[] {
  const first = uniqBy(pinned, ({ value }) => value)
  const taken = new Set(first.map(({ value }) => value))
  const byPrefix = groupBy(
    zones.filter((zone) => !taken.has(zone)),
    (zone) => prefixOf(zone) || otherName,
  )
  const groups = sortBy(Object.entries(byPrefix), [([name]) => name]).map(([name, list]) => ({
    value: name,
    items: list.toSorted().map((zone) => zoneOption(zone, { title: zone })),
  }))
  return [{ value: '', items: first }, ...groups]
}

export type ZoneTime = { date: string; time: string; isOtherDay: boolean }

export function timeInZone(
  from: string,
  to: string,
  date: string,
  time: string,
): ZoneTime | undefined {
  if (!from || !to || from === to || !date || !time) return undefined
  try {
    const here = Temporal.PlainDateTime.from(`${date}T${time}`)
      .toZonedDateTime(from)
      .withTimeZone(to)
    const hereDate = here.toPlainDate().toString()
    return {
      date: hereDate,
      time: here.toPlainTime().toString({ smallestUnit: 'minute' }),
      isOtherDay: hereDate !== date,
    }
  } catch {
    return undefined
  }
}
