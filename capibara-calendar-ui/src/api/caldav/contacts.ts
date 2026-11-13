import { contactId, type Contact } from '../calendar-api'

const hasScheme = /^[a-z][a-z0-9+.-]*:/i

const unfold = (data: string) => data.replace(/\r?\n[ \t]/g, '')

const unescape = (value: string) =>
  value.replace(/\\([,;nN\\])/g, (_match, character: string) =>
    character.toLowerCase() === 'n' ? '\n' : character,
  )

function propertyOf(lines: string[], name: string) {
  const line = lines.find((candidate) => new RegExp(`^${name}[;:]`, 'i').test(candidate))
  return line ? unescape(line.slice(line.indexOf(':') + 1).trim()) : ''
}

export function parseVCard(data: string): Contact | undefined {
  const lines = unfold(data).split(/\r?\n/)
  const name = propertyOf(lines, 'FN')
  const uid = propertyOf(lines, 'UID')
  if (!name || !uid) return undefined
  return {
    id: contactId(hasScheme.test(uid) ? uid : `urn:x-vcard-uid:${encodeURIComponent(uid)}`),
    name,
  }
}
