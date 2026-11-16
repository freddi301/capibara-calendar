import { z } from 'zod'
import { connectionIds, loadConnectionOf } from '../lib/connection'
import { isWebxdc } from '../lib/webxdc'
import {
  sourceId,
  type CalendarSource,
  type SourceConfig,
  type SourceInfo,
  type SourceKind,
} from './calendar-api'
import { CaldavSource } from './caldav/source'
import { IndexedDbStore } from './local/indexeddb-store'
import { LocalSource } from './local/source'
import { MemoryStore } from './local/memory-store'
import { Registry } from './registry'
import { chatSourceId, chatStore } from './webxdc/chat'

const storageKey = 'capibara-calendar-sources'

const stateSchema = z.object({
  memory: z.boolean().catch(false),
  local: z.boolean().catch(false),
  chat: z.boolean().catch(false).default(isWebxdc()),
})

export type SourcesState = z.infer<typeof stateSchema>

export function loadSourcesState(): SourcesState {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = stateSchema.safeParse(stored ? JSON.parse(stored) : {})
    return parsed.success ? parsed.data : { memory: false, local: false, chat: isWebxdc() }
  } catch {
    return { memory: false, local: false, chat: isWebxdc() }
  }
}

export function saveSourcesState(state: SourcesState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(stateSchema.parse(state)))
  } catch {
    // storage is blocked
  }
}

const sourceNames: Record<SourceKind, string> = {
  caldav: 'CalDAV',
  local: 'Local',
  memory: 'Memory',
  webxdc: 'Chat',
}

const infoOf = (kind: SourceKind, id: string, name: string): SourceInfo => ({
  id: sourceId(id),
  kind,
  name,
})

const memoryStore = new MemoryStore()
let localStore: IndexedDbStore | undefined

const caldavSourceId = sourceId('caldav')
const memorySourceId = sourceId('memory')
const localSourceId = sourceId('local')

export function buildSource(config: SourceConfig, secrets: { password?: string }): CalendarSource {
  if (config.kind === 'memory')
    return new LocalSource(infoOf('memory', config.id, config.name), memoryStore)
  if (config.kind === 'webxdc') {
    return new LocalSource(infoOf('webxdc', config.id, config.name), chatStore())
  }
  if (config.kind === 'local') {
    localStore ??= new IndexedDbStore()
    return new LocalSource(infoOf('local', config.id, config.name), localStore)
  }
  return new CaldavSource(infoOf('caldav', config.id, config.name), {
    url: String(config.settings.url),
    username: String(config.settings.username),
    password: secrets.password ?? '',
  })
}

export function checkCaldav(
  connection: { url: string; username: string; password: string },
  id: string = caldavSourceId,
) {
  return buildSource(
    {
      id: sourceId(id),
      kind: 'caldav',
      name: hostOf(connection.url),
      settings: { url: connection.url, username: connection.username },
    },
    { password: connection.password },
  ).check()
}

const hostOf = (url: string) => {
  try {
    return new URL(url, window.location.origin).host
  } catch {
    return url
  }
}

export function createRegistry() {
  const state = loadSourcesState()
  if (isWebxdc()) {
    const chat = buildSource(
      { id: chatSourceId, kind: 'webxdc', name: sourceNames.webxdc, settings: {} },
      {},
    )
    return new Registry(buildSource, state.chat ? [chat] : [])
  }
  const sources: CalendarSource[] = []
  for (const id of connectionIds()) {
    const connection = loadConnectionOf(id)
    if (!connection) continue
    sources.push(
      buildSource(
        {
          id: sourceId(id),
          kind: 'caldav',
          name: hostOf(connection.url),
          settings: { url: connection.url, username: connection.username },
        },
        { password: connection.password },
      ),
    )
  }
  if (state.local) {
    sources.push(
      buildSource({ id: localSourceId, kind: 'local', name: sourceNames.local, settings: {} }, {}),
    )
  }
  if (state.memory) {
    sources.push(
      buildSource(
        { id: memorySourceId, kind: 'memory', name: sourceNames.memory, settings: {} },
        {},
      ),
    )
  }
  return new Registry(buildSource, sources)
}
