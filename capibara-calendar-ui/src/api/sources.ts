import { connectionIds, loadConnectionOf } from '../lib/connection'
import { getStored } from '../lib/use-stored'
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
import { nameOfFeed } from '../lib/webcal'
import { readFeed } from './webcal/feed'
import { WebcalSource } from './webcal/source'
import { chatSourceId, chatStore } from './webxdc/chat'

const sourceNames: Record<SourceKind, string> = {
  caldav: 'CalDAV',
  local: 'Local',
  memory: 'Memory',
  webxdc: 'Chat',
  webcal: 'Webcal',
}

const infoOf = (kind: SourceKind, id: string, name: string): SourceInfo => ({
  id: sourceId(id),
  kind,
  name,
})

const memoryStore = new MemoryStore()
let localStore: IndexedDbStore | undefined

const caldavSourceId = sourceId('caldav')
const localSourceId = sourceId('local')

export function buildSource(config: SourceConfig, secrets: { password?: string }): CalendarSource {
  if (config.kind === 'memory')
    return new LocalSource(infoOf('memory', config.id, config.name), memoryStore)
  if (config.kind === 'webxdc') {
    return new LocalSource(infoOf('webxdc', config.id, config.name), chatStore())
  }
  if (config.kind === 'webcal') return new WebcalSource(infoOf('webcal', config.id, config.name))
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

export async function checkWebcal(url: string) {
  const { name, color } = await readFeed(url)
  return { name, color }
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

export const hostOf = (url: string) => {
  try {
    return new URL(url, window.location.origin).host
  } catch {
    return url
  }
}

export function createRegistry() {
  const state = getStored().sources
  if (isWebxdc()) {
    const chat = buildSource(
      { id: chatSourceId, kind: 'webxdc', name: sourceNames.webxdc, settings: {} },
      {},
    )
    return new Registry(buildSource, [chat])
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
  for (const [id, { url }] of Object.entries(getStored().webcals)) {
    sources.push(
      buildSource({ id: sourceId(id), kind: 'webcal', name: nameOfFeed(url), settings: {} }, {}),
    )
  }
  if (state.local) {
    sources.push(
      buildSource({ id: localSourceId, kind: 'local', name: sourceNames.local, settings: {} }, {}),
    )
  }
  return new Registry(buildSource, sources)
}
