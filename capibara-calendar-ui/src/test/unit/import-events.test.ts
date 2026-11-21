import { getApi } from '@/api'
import { beforeEach, expect, it } from 'vitest'
import { refOfKey } from '@/lib/calendars'
import { serveEvents, keyOf } from '@/test/server'

const calendars = [
  { url: '/personal/', name: 'Personal', color: '#2563eb' },
  { url: '/work/', name: 'Work', color: '#16a34a' },
]
const personal = () => refOfKey(keyOf('/personal/'))
const work = () => refOfKey(keyOf('/work/'))

const item = (uid: string, title: string, ...more: string[]) => ({
  uid,
  ics: [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//x//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    'DTSTAMP:20260101T000000Z',
    `SUMMARY:${title}`,
    'DTSTART:20261112T093000Z',
    ...more,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n'),
})

beforeEach(() => {
  serveEvents([], calendars)
})

it('puts the events in the calendar, and replaces the one that has the same UID', async () => {
  const api = getApi()

  const first = await api.importEvents(personal(), [item('a', 'Dentist'), item('b', 'Lunch')])
  expect(first.map(({ result }) => result)).toEqual(['created', 'created'])
  const second = await api.importEvents(personal(), [item('a', 'Dentist moved', 'SEQUENCE:4')])
  expect(second.map(({ result }) => result)).toEqual(['updated'])

  const text = (await api.exportEvents(personal())).join('\n')
  expect(text).toContain('SUMMARY:Dentist moved')
  expect(text).toContain('SEQUENCE:4')
  expect(text).toContain('SUMMARY:Lunch')
  expect(text).not.toContain('SUMMARY:Dentist\r')
  expect((await api.exportEvents(personal())).length).toBe(2)
})

it('says what could not be imported, and imports the rest', async () => {
  const outcomes = await getApi().importEvents(personal(), [
    { uid: 'bad', ics: 'nonsense' },
    item('ok', 'Fine'),
  ])
  expect(outcomes).toEqual([
    { uid: 'bad', result: 'failed', error: 'unreadable' },
    { uid: 'ok', result: 'created' },
  ])
})

it('keeps the properties that start with X-, the guests, and gives back the same event when it is exported', async () => {
  const api = getApi()
  await api.importEvents(personal(), [item('a', 'Dentist', 'X-KEPT:as it was', 'SEQUENCE:2')])

  const [text] = await api.exportEvents(personal())

  expect(text).toContain('X-KEPT:as it was')
  expect(text).toContain('UID:a')
  expect(text).toContain('SEQUENCE:2')
})

it('does not take an event of another calendar of the same place: it says so', async () => {
  const api = getApi()
  await api.importEvents(personal(), [item('a', 'Dentist')])

  const outcomes = await api.importEvents(work(), [item('a', 'Dentist at work')])

  expect(outcomes).toEqual([{ uid: 'a', result: 'failed', error: 'in another calendar' }])
  expect((await api.exportEvents(work())).length).toBe(0)
})
