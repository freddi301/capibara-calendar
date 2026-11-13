import { t } from '@lingui/core/macro'
import * as Y from 'yjs'
import { incrementalProtocol, WebxdcProvider, type WebxdcTransport } from 'y-webxdc'
import { YjsStore } from './yjs-store'

let store: YjsStore | undefined

export function chatStore() {
  if (store) return store
  const doc = new Y.Doc()
  const webxdc = (window as unknown as { webxdc: WebxdcTransport }).webxdc
  const provider = new WebxdcProvider({
    webxdc,
    ydoc: doc,
    protocol: incrementalProtocol(),
    getEditInfo: () => ({ summary: t`${doc.getMap('events').size} events` }),
  })
  store = new YjsStore(doc, () => {
    provider.syncToChatPeers()
  })
  return store
}
