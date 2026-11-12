import 'fake-indexeddb/auto'
import { isoDate, sourceId, type CalendarSource, type SourceInfo } from '../../api/calendar-api'
import { IndexedDbStore } from '../../api/local/indexeddb-store'
import { MemoryStore } from '../../api/local/memory-store'
import { LocalSource } from '../../api/local/source'
import { describe, expect, it, vi } from 'vitest'
import { describeContract, eventValues, options } from './contract'

const info = (kind: 'memory' | 'local'): SourceInfo => ({ id: sourceId(kind), kind, name: kind })

describeContract('the memory source', () =>
  Promise.resolve(new LocalSource(info('memory'), new MemoryStore())),
)

let count = 0
describeContract('the local source', () => {
  count += 1
  const source: CalendarSource = new LocalSource(info('local'), new IndexedDbStore(`test-${count}`))
  return Promise.resolve(source)
})

const week = { start: isoDate('2026-11-09'), end: isoDate('2026-11-15') }

describe('two tabs on the same local database', () => {
  async function tabs() {
    count += 1
    const name = `tabs-${count}`
    const first = new LocalSource(info('local'), new IndexedDbStore(name))
    const second = new LocalSource(info('local'), new IndexedDbStore(name))
    const calendar = (await first.createCalendar({ name: 'Shared', color: '#2563eb' })).ref
    return { first, second, calendar }
  }

  it('see what the other wrote, and the later of two changes of the same version is refused', async () => {
    const { first, second, calendar } = await tabs()
    const created = await first.createEvent(calendar, eventValues({ title: 'Meeting' }))
    expect(await second.listEvents(calendar, week, options)).toHaveLength(1)

    await first.updateEvent(created, eventValues({ title: 'Meeting, moved' }), 'all')
    await expect(
      second.updateEvent(created, eventValues({ title: 'Mine' }), 'all'),
    ).rejects.toMatchObject({
      kind: 'conflict',
    })
  })

  it('are told when the other one writes', async () => {
    const { first, second, calendar } = await tabs()
    const told = vi.fn()
    second.subscribe(told)

    await first.createEvent(calendar, eventValues())

    await vi.waitFor(() => {
      expect(told).toHaveBeenCalled()
    })
  })
})
