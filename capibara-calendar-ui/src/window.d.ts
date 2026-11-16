import type { WebxdcTransport } from 'y-webxdc'

type WebxdcFiles = {
  sendToChat(message: {
    text?: string
    file?: { name: string } & ({ blob: Blob } | { base64: string } | { plainText: string })
  }): Promise<void>
  importFiles(filter: {
    extensions?: string[]
    mimeTypes?: string[]
    multiple?: boolean
  }): Promise<File[]>
}

declare global {
  interface Window {
    webxdc?: WebxdcTransport & WebxdcFiles & { selfAddr: string; selfName: string }
  }
}
