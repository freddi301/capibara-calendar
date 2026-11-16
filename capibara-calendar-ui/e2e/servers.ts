// The CalDAV servers that the e2e tests run against (see compose.yaml). A test run talks to one of
// them, chosen by the Playwright project.
export type ServerId = 'radicale' | 'baikal'

type Server = {
  /** The address that the app connects to, through the dev server. */
  root: string
  /** Where the calendars of the user are, as the app reaches them. */
  home: string
  /** The address book that the tests fill. */
  contacts: string
  /** What the dev server puts in front of a path that the server answers with. */
  prefix: string
  /** The server as the tests reach it without the browser. */
  direct: { origin: string; home: string }
}

export const servers: Record<ServerId, Server> = {
  radicale: {
    root: '/radicale/',
    home: '/radicale/dev/',
    contacts: '/radicale/dev/contacts/',
    prefix: '/radicale',
    direct: { origin: 'http://localhost:5232', home: '/dev/' },
  },
  baikal: {
    // Baikal answers with paths that start with /dav.php: the dev server leaves them as they are.
    root: '/dav.php/',
    home: '/dav.php/calendars/dev/',
    contacts: '/dav.php/addressbooks/dev/default/',
    prefix: '',
    direct: { origin: 'http://localhost:5233', home: '/dav.php/calendars/dev/' },
  },
}

// A worker runs the tests of one project, one at a time: this is the server of that project.
let current: ServerId = 'radicale'

export function useServer(id: ServerId) {
  current = id
}

export const server = () => servers[current]
