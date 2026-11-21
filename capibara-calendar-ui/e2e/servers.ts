// The CalDAV servers that the e2e tests run against: the services `radicale-e2e` and `baikal-e2e` of
// compose.yaml, which are not the Radicale of the hand tests (port 5232). A test run talks to one of
// them, chosen by the Playwright project.
export type ServerId = 'radicale' | 'baikal'

/** How many tests run at the same time: each of them has its own user on Radicale (see `userOf`). */
export const workerCount = 6

type Server = {
  /** The address that the app connects to, through the dev server. */
  root: string
  /** Where the calendars of a user are, as the app reaches them. */
  home: (user: string) => string
  /** The address book that the tests fill. */
  contacts: (user: string) => string
  /** What the dev server puts in front of a path that the server answers with. */
  prefix: string
  /** The server as the tests reach it without the browser. */
  direct: { origin: string; home: (user: string) => string }
  /** The users of the server that the tests use. */
  users: string[]
}

/**
 * The user of a worker. Radicale takes any login (`AUTH_TYPE: none`) and keeps the calendars of each
 * user apart: a test that makes, hides or deletes a calendar does not disturb the ones that run at
 * the same time. Baikal has its one user.
 */
export const userOf = (id: ServerId, parallelIndex: number) =>
  id === 'radicale' ? `dev${parallelIndex}` : 'dev'

export const servers: Record<ServerId, Server> = {
  radicale: {
    root: '/radicale/',
    home: (user) => `/radicale/${user}/`,
    contacts: (user) => `/radicale/${user}/contacts/`,
    prefix: '/radicale',
    // radicale-e2e (the dev server of the tests proxies /radicale to it)
    direct: { origin: 'http://localhost:5234', home: (user) => `/${user}/` },
    users: ['dev', ...Array.from({ length: workerCount }, (_, index) => `dev${index}`)],
  },
  baikal: {
    // baikal-e2e. Baikal answers with paths that start with /dav.php: the dev server leaves them as
    // they are. (Its base_uri cannot be moved under /baikal: it refuses a path outside of it.)
    root: '/dav.php/',
    home: (user) => `/dav.php/calendars/${user}/`,
    contacts: (user) => `/dav.php/addressbooks/${user}/default/`,
    prefix: '',
    direct: { origin: 'http://localhost:5233', home: (user) => `/dav.php/calendars/${user}/` },
    users: ['dev'],
  },
}

// A worker runs the tests of one project, one at a time: this is the server and the user of that worker.
let current: ServerId = 'radicale'
let currentUser = userOf('radicale', 0)

export function useServer(id: ServerId, parallelIndex: number) {
  current = id
  currentUser = userOf(id, parallelIndex)
}

/** The server of this worker, with the places of its user. */
export function server() {
  const { root, prefix, home, contacts } = servers[current]
  return {
    root,
    prefix,
    user: currentUser,
    home: home(currentUser),
    contacts: contacts(currentUser),
  }
}

/** The header of the requests that the tests make without the browser, as the user of this worker. */
export const authorization = () => `Basic ${Buffer.from(`${currentUser}:dev`).toString('base64')}`
