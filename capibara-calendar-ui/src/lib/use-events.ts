import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { DisplayEvent } from './display-event'
import { chunkQuery, monthsOf, shiftMonth } from './event-chunks'
import { matches } from './event-filter'
import { useCalendars } from './use-calendars'
import { useStored } from './use-stored'
import type { DateRange } from './week'

const keyOf = ({ key, startDate, startTime }: DisplayEvent) => `${key} ${startDate} ${startTime}`

const overlaps = ({ startDate, endDate }: DisplayEvent, { start, end }: DateRange) =>
  startDate <= end && (endDate || startDate) >= start

function useChunks(ranges: DateRange[], middle: DateRange) {
  const client = useQueryClient()
  const calendars = useCalendars()
  const rules = useStored((stored) => stored.eventFilter)
  const hidden = useStored((stored) => stored.hiddenCalendars)
  const urls = (calendars.data ?? []).map(({ url }) => url).filter((url) => !hidden.includes(url))
  const months = monthsOf(ranges)
  const onScreen = new Set(monthsOf([middle]))

  const result = useQueries({
    queries: urls.flatMap((url) => months.map((month) => chunkQuery(client, url, month))),
    combine: (results) => {
      const shown = results.filter((_, index) => onScreen.has(months[index % months.length]))
      const seen = new Set<string>()
      const data = results
        .flatMap((result) => result.data?.events ?? [])
        .filter((event) => ranges.some((range) => overlaps(event, range)))
        .filter((event) => !seen.has(keyOf(event)) && seen.add(keyOf(event)))
        .filter(({ source }) => matches(rules, source))
      return {
        data,
        isSuccess:
          calendars.isSuccess && shown.every((result) => result.isSuccess && !result.isFetching),
        isLoaded: calendars.isSuccess && results.every((result) => !result.isPending),
        isError: calendars.isError || shown.some((result) => result.isError),
      }
    },
  })

  const urlsKey = JSON.stringify(urls)
  const screenKey = [...onScreen].join()
  const isThere = result.isSuccess
  useEffect(() => {
    if (!isThere) return
    const screen = screenKey.split(',')
    const around = [shiftMonth(screen[0], -1), shiftMonth(screen[screen.length - 1], 1)]
    for (const url of JSON.parse(urlsKey) as string[]) {
      for (const month of around) {
        client.query(chunkQuery(client, url, month)).catch(() => undefined)
      }
    }
  }, [client, urlsKey, screenKey, isThere])

  return result
}

export function useEvents(range: DateRange, onScreen: DateRange = range) {
  return useChunks([range], onScreen)
}

export function useEventPages(ranges: DateRange[]) {
  return useChunks(ranges, ranges[Math.floor(ranges.length / 2)])
}
