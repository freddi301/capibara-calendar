import type { Coordinates } from '@/api/calendar-api'

const digits = (value: number) => String(Number(value.toFixed(6)))

export const formatCoordinates = ({ latitude, longitude }: Coordinates) =>
  `${digits(latitude)}, ${digits(longitude)}`

export const geoLink = ({ latitude, longitude }: Coordinates) =>
  `geo:${digits(latitude)},${digits(longitude)}`

export function parseCoordinates(text: string): Coordinates | undefined {
  const found = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text)
  if (!found) return undefined
  const latitude = Number(found[1])
  const longitude = Number(found[2])
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : undefined
}
