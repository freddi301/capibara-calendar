import { proxyFetch } from '../../lib/proxy-fetch'
import { fullRights, type CalendarRights } from '../calendar-api'

const body =
  '<?xml version="1.0" encoding="UTF-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-privilege-set/></d:prop></d:propfind>'

export function rightsOf(privileges: string[]): CalendarRights {
  const has = (...names: string[]) => names.some((name) => privileges.includes(name))
  const everything = has('all', 'write')
  return {
    create: everything || has('bind'),
    update: everything || has('write-content'),
    remove: everything || has('unbind'),
  }
}

export function parsePrivileges(xml: string, base: string): Map<string, CalendarRights> {
  const rights = new Map<string, CalendarRights>()
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  for (const response of Array.from(document.getElementsByTagNameNS('DAV:', 'response'))) {
    const href = response.getElementsByTagNameNS('DAV:', 'href').item(0)?.textContent
    const set = response.getElementsByTagNameNS('DAV:', 'current-user-privilege-set').item(0)
    if (!href || !set) continue
    const names = Array.from(set.getElementsByTagNameNS('DAV:', 'privilege')).flatMap((privilege) =>
      Array.from(privilege.children).map((child) => child.localName),
    )
    rights.set(new URL(href, base).href, rightsOf(names))
  }
  return rights
}

export async function fetchRights(
  home: string,
  authorization: string,
): Promise<Map<string, CalendarRights>> {
  try {
    const response = await proxyFetch(home, {
      method: 'PROPFIND',
      headers: {
        Authorization: authorization,
        Depth: '1',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body,
    })
    if (response.status !== 207) return new Map()
    return parsePrivileges(await response.text(), home)
  } catch {
    return new Map()
  }
}

export const rightsFor = (rights: Map<string, CalendarRights>, url: string) =>
  rights.get(new URL(url).href) ?? fullRights
