import type { WebxdcTransport } from 'y-webxdc'

declare global {
  interface Window {
    webxdc?: WebxdcTransport & { selfAddr: string; selfName: string }
  }
}
