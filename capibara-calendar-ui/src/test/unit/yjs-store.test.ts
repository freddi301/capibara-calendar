import * as Y from 'yjs'
import { expect, it } from 'vitest'
import { contactId, isoDate, sourceId, type SourceInfo } from '@/api/calendar-api'
import { LocalSource } from '@/api/local/source'
import { introduce, YjsStore } from '@/api/webxdc/yjs-store'
import { eventValues, options } from '@/test/support/contract'

const info: SourceInfo = { id: sourceId('chat'), kind: 'webxdc', name: 'Chat' }
const week = { start: isoDate('2026-11-09'), end: isoDate('2026-11-15') }

/** Two devices of one chat: what each writes reaches the other only when they are told to meet. */
function devices() {
  const first = new Y.Doc()
  const second = new Y.Doc()
  const told: string[] = []
  const store = new YjsStore(second, () => undefined)
  store.subscribe(() => told.push('second'))
  const meet = () => {
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first), 'remote')
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second), 'remote')
  }
  return {
    one: new LocalSource(info, new YjsStore(first, () => undefined)),
    two: new LocalSource(info, store),
    meet,
    told,
  }
}

it('keeps what two people changed at once, each a different thing, and the answer of each of them', async () => {
  const { one, two, meet, told } = devices()
  const calendar = (await one.createCalendar({ name: 'Team', color: '#2563eb' })).ref
  const created = await one.createEvent(
    calendar,
    eventValues({
      participants: [
        { id: contactId('ada'), status: 'needs-action' },
        { id: contactId('bruno'), status: 'needs-action' },
      ],
    }),
  )
  meet()
  expect(told.length).toBeGreaterThan(0) // the other device is told of what was done on this one

  const seen = await two.getEvent(created.ref)
  await one.updateEvent(created, { title: 'Planning, longer' }, 'all')
  await two.updateEvent(
    seen,
    {
      locations: [{ name: 'Room 4' }],
      participants: { set: [{ id: contactId('ada'), status: 'accepted' }], remove: [] },
    },
    'all',
  )
  await one.updateEvent(
    created,
    { participants: { set: [{ id: contactId('bruno'), status: 'declined' }], remove: [] } },
    'all',
  )
  meet()

  for (const source of [one, two]) {
    const [event] = await source.listEvents(calendar, week, options)
    expect(event).toMatchObject({ title: 'Planning, longer', locations: [{ name: 'Room 4' }] })
    expect(event.participants).toEqual([
      { id: 'ada', status: 'accepted' },
      { id: 'bruno', status: 'declined' },
    ])
  }

  const before = told.length
  await two.deleteEvent((await two.listEvents(calendar, week, options))[0], 'all')
  expect(told.length).toBe(before) // what a device does itself is not told to it
})

it('lists the people of the chat as contacts, with the latest name that each gave', async () => {
  const first = new Y.Doc()
  const second = new Y.Doc()
  const adaStore = new YjsStore(first, () => undefined)
  const brunoStore = new YjsStore(second, () => undefined)
  const chat = new LocalSource(info, adaStore)
  const sync = () => {
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first), 'remote')
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second), 'remote')
  }

  expect(await introduce(adaStore, 'addr-ada', 'Ada')).toBe(true)
  expect(await introduce(adaStore, 'addr-ada', 'Ada')).toBe(false) // already there: nothing is written
  expect(await introduce(brunoStore, 'addr-bruno', 'Bruno')).toBe(true)
  sync()
  expect(await chat.listContacts()).toEqual([
    { id: 'addr-ada', name: 'Ada' },
    { id: 'addr-bruno', name: 'Bruno' },
  ])

  expect(await introduce(brunoStore, 'addr-bruno', 'Bruna')).toBe(true) // the name was changed
  sync()
  expect((await chat.listContacts()).map(({ name }) => name)).toEqual(['Ada', 'Bruna'])
})
