import { i18n } from '@lingui/core'
import * as Y from 'yjs'
import { incrementalProtocol, WebxdcProvider, type WebxdcTransport } from 'y-webxdc'
import { activeTimeZone } from '../../lib/settings'
import { sourceId } from '../calendar-api'
import { notificationsOf } from './notifications'
import { introduce, YjsStore } from './yjs-store'

export const chatSourceId = sourceId('chat')

const introduceDelay = 2000

let store: YjsStore | undefined

export function chatStore() {
  if (store) return store
  const doc = new Y.Doc()
  const webxdc = window.webxdc
  if (!webxdc) throw new Error('The chat is only there when the app runs in a chat')
  const later: { chat?: YjsStore } = {}
  const transport: WebxdcTransport = {
    setUpdateListener: (listener, serial) => webxdc.setUpdateListener(listener, serial),
    sendUpdate: (update, descr) => {
      const told = notificationsOf(later.chat?.takeChanges() ?? [], {
        author: webxdc.selfName,
        people: new Map(doc.getMap<string>('people')),
        sourceId: chatSourceId,
        now: Date.now(),
        locale: i18n.locale, // the texts are for the others, in the language and the zone of the author
        timeZone: activeTimeZone(),
      })
      webxdc.sendUpdate(told ? { ...update, ...told } : update, descr)
    },
    sendUpdateInterval: webxdc.sendUpdateInterval,
    joinRealtimeChannel: webxdc.joinRealtimeChannel?.bind(webxdc),
  }
  const provider = new WebxdcProvider({
    webxdc: transport,
    ydoc: doc,
    protocol: incrementalProtocol(),
    getEditInfo: () => ({
      summary: `${doc.getMap('people').size}👥 ${doc.getMap('calendars').size}📚 ${doc.getMap('events').size}🗓️`,
    }),
  })
  const chat = new YjsStore(doc, () => {
    provider.syncToChatPeers()
  })
  later.chat = chat
  window.setTimeout(() => {
    void introduce(chat, webxdc.selfAddr, webxdc.selfName) // the write is sent to the chat by the store
  }, introduceDelay)
  store = chat
  return chat
}
