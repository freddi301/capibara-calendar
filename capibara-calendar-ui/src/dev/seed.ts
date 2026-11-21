import { range } from 'es-toolkit'
import { setApi } from '../api'
import {
  contactId,
  sourceId,
  timeZoneId,
  type CalendarSource,
  type Contact,
} from '../api/calendar-api'
import { Registry } from '../api/registry'
import { buildSource } from '../api/sources'
import { activeTimeZone, type Settings } from '../lib/settings'
import {
  allDay,
  calendars,
  people,
  reminder,
  timed,
  weekdays,
  type Day,
  type Planned,
} from './seed-helpers'
import { showcase, showcaseContacts } from './seed-showcase'

type Seed = 'realistic' | 'stress' | 'zones' | 'showcase'

const settingsOf: Record<Seed, Settings> = {
  realistic: { language: 'en', theme: 'light' },
  zones: { language: 'en', theme: 'light' },
  stress: { language: 'it', theme: 'dark' },
  showcase: { language: 'en', theme: 'dark' },
}

async function realistic(source: CalendarSource, today: Day): Promise<Planned[]> {
  const [work, personal, family] = await calendars(source, ['Work', 'Personal', 'Family'])
  const day = (offset: number) => today.add({ days: offset })
  return [
    [
      work,
      timed(day(-7), '09:00', 'PT15M', {
        title: 'Team standup',
        recurrenceRules: [{ frequency: 'weekly', byDay: weekdays }],
      }),
    ],
    [
      work,
      timed(day(0), '11:00', 'PT1H', { title: 'Design review', locations: [{ name: 'Room 2B' }] }),
    ],
    [work, timed(day(0), '15:00', 'PT30M', { title: 'Call with supplier' })],
    [
      personal,
      timed(day(1), '12:30', 'PT1H', {
        title: 'Lunch with Anna',
        locations: [
          { name: 'Trattoria da Luigi', coordinates: { latitude: 45.4642, longitude: 9.19 } },
        ],
      }),
    ],
    [family, allDay(day(2), 1, { title: "Mum's birthday" })],
    [
      work,
      timed(day(2), '10:00', 'PT1H30M', {
        title: 'Sprint planning',
        description: 'Bring the estimates for the import screen.',
        participants: people(['anna', 'marco', 'giulia']),
        alerts: [reminder('-PT15M')],
      }),
    ],
    [
      personal,
      timed(day(-6), '18:30', 'PT1H', {
        title: 'Gym',
        recurrenceRules: [{ frequency: 'weekly', byDay: [{ day: 'tu' }, { day: 'th' }] }],
      }),
    ],
    [personal, timed(day(3), '16:00', 'PT1H', { title: 'Dentist', status: 'tentative' })],
    [family, allDay(day(4), 2, { title: 'Weekend in the mountains' })],
    [
      work,
      timed(day(7), '11:00', 'PT1H', {
        title: 'Quarterly review',
        virtualLocations: [{ uri: 'https://meet.example.com/quarterly' }],
      }),
    ],
    [work, timed(day(-2), '14:00', 'PT2H', { title: 'Workshop' })],
  ]
}

/** The ways that an event can be in other time zones than the one of the app, all on tomorrow. */
async function zones(source: CalendarSource, today: Day): Promise<Planned[]> {
  const [personal] = await calendars(source, ['Personal'])
  const day = (offset: number) => today.add({ days: offset })
  return [
    [personal, timed(day(1), '10:00', 'PT1H', { title: 'Zone 1 in the zone of the app' })],
    [
      personal,
      timed(day(1), '09:00', 'PT1H30M', { title: 'Zone 2 UTC', timeZone: timeZoneId('UTC') }),
    ],
    [
      personal,
      timed(day(1), '11:00', 'PT1H', {
        title: 'Zone 3 Auckland, the day changes',
        timeZone: timeZoneId('Pacific/Auckland'),
      }),
    ],
    [
      personal,
      timed(day(1), '15:00', 'PT5H30M', {
        title: 'Zone 4 UTC to New York',
        timeZone: timeZoneId('UTC'),
        endTimeZone: timeZoneId('America/New_York'),
      }),
    ],
    [
      personal,
      timed(day(1), '20:00', 'P2DT4H', {
        title: 'Zone 5 Tokyo, many days',
        timeZone: timeZoneId('Asia/Tokyo'),
      }),
    ],
    [
      personal,
      timed(day(1), '10:00', 'PT8H30M', {
        title: 'Zone 6 Rome to New York',
        endTimeZone: timeZoneId('America/New_York'),
      }),
    ],
    [
      personal,
      timed(day(1), '22:00', 'PT11H', {
        title: 'Zone 7 Tokyo to Los Angeles',
        timeZone: timeZoneId('Asia/Tokyo'),
        endTimeZone: timeZoneId('America/Los_Angeles'),
      }),
    ],
    [personal, timed(day(1), '09:00', 'PT1H', { title: 'Zone 8 floating', timeZone: null })],
  ]
}

const noSpaces = 'Riunionestraordinariadelconsigliodiamministrazionesulbilanciopreventivo2027'
const longTitle =
  'Incontro trimestrale con tutti i responsabili di reparto per discutere obiettivi, budget, ' +
  'assunzioni e la riorganizzazione degli uffici della sede centrale di Milano'
const paragraph =
  'Ordine del giorno: approvazione del verbale della seduta precedente, presentazione dei ' +
  'risultati del trimestre, proposte di miglioramento dei processi interni e varie ed eventuali. '
const titles = [
  longTitle,
  noSpaces,
  'Caffè',
  '🎉🎂 Festa a sorpresa per il compleanno di Giulia 🎈🥳',
  'Ok',
]

async function stress(source: CalendarSource, today: Day): Promise<Planned[]> {
  const refs = await calendars(source, [
    'Calendariocondivisodelrepartoamministrazioneefinanzasedecentrale',
    ...range(29).map(
      (index) => `Calendario condiviso del gruppo di lavoro numero ${String(index + 1)}`,
    ),
  ])
  const calendar = (index: number) => refs[index % refs.length]
  const day = (offset: number) => today.add({ days: offset })
  const title = (index: number) => titles[index % titles.length]

  const clock = (minutes: number) =>
    Temporal.PlainTime.from({ hour: Math.floor(minutes / 60), minute: minutes % 60 }).toString({
      smallestUnit: 'minute',
    })

  const crowded = range(15).map((index): Planned => [
    calendar(index),
    timed(day(0), clock(8 * 60 + index * 30), 'PT45M', { title: title(index) }),
  ])
  const overlapping = ['PT1H', 'PT2H', 'PT30M', 'PT3H'].map((length, index): Planned => [
    calendar(index + 3),
    timed(day(0), '10:00', length, { title: title(index) }),
  ])
  const allDays = range(6).map((index): Planned => [
    calendar(index),
    allDay(day(0), 1, { title: title(index) }),
  ])
  const everyDay = range(-21, 22).flatMap((offset) =>
    range(4).map((index): Planned => [
      calendar(offset + index + 21),
      timed(day(offset), clock((9 + index * 2) * 60), 'PT1H', {
        title: title(offset + index + 21),
      }),
    ]),
  )
  const detailed = timed(day(1), '09:00', 'PT2H', {
    title: longTitle,
    description: paragraph.repeat(15),
    locations: [
      {
        name: `Sala riunioni ${noSpaces}`,
        coordinates: { latitude: 44.382218, longitude: 9.043288 },
      },
      { name: 'Via Giuseppe Garibaldi 128, 20121 Milano' },
    ],
    virtualLocations: [
      { uri: `https://videoconferenza.example.com/stanza/${noSpaces}?pwd=${noSpaces}` },
    ],
    keywords: range(10).map((index) => `etichetta-molto-lunga-numero-${String(index)}`),
    alerts: ['-PT5M', '-PT15M', '-PT1H', '-P1D', '-P1W'].map(reminder),
    participants: people(range(50).map((index) => `nome.cognome.molto.lungo.${String(index)}`)),
    status: 'tentative',
    color: '#dc2626',
  })

  return [
    ...crowded,
    ...overlapping,
    ...allDays,
    ...everyDay,
    [calendar(0), detailed],
    [calendar(1), allDay(day(-2), 10, { title: longTitle })],
    [
      calendar(2),
      timed(day(0), '22:00', 'PT4H', { title: 'Turno di notte che attraversa la mezzanotte' }),
    ],
    [calendar(3), timed(day(1), '08:00', 'P2DT4H', { title: 'Trasferta di più giorni a Roma' })],
    [calendar(4), timed(day(1), '11:00', 'PT1H', { title: noSpaces, status: 'cancelled' })],
    [
      calendar(5),
      timed(day(-30), '07:30', 'PT15M', {
        title: 'Promemoria giornaliero per prendere le medicine prima di colazione',
        recurrenceRules: [{ frequency: 'daily' }],
      }),
    ],
  ]
}

const firstNames = [
  'Anna',
  'Marco',
  'Giulia',
  'Luca',
  'Sofia',
  'Matteo',
  'Chiara',
  'Davide',
  'Elena',
  'Paolo',
]
const lastNames = [
  'Rossi',
  'Bianchi',
  'Verdi',
  'Neri',
  'Romano',
  'Ferrari',
  'Esposito',
  'Colombo',
  'Ricci',
  'Marino',
]

const stressContacts = (): Promise<Contact[]> =>
  Promise.resolve(
    range(150).map((index) => {
      const name = `${firstNames[index % 10]} ${lastNames[Math.floor(index / 10) % 10]} ${index + 1}`
      return { id: contactId(`mailto:contact${index + 1}@example.com`), name }
    }),
  )

/** Fills the memory source when the URL asks for a seed, and returns the settings to apply. */
export async function seedFromUrl(): Promise<Settings | undefined> {
  const params = new URLSearchParams(window.location.search)
  const seed = params.get('seed')
  if (seed !== 'realistic' && seed !== 'stress' && seed !== 'zones' && seed !== 'showcase')
    return undefined
  const source = buildSource(
    { id: sourceId('memory'), kind: 'memory', name: 'Memory', settings: {} },
    {},
  )
  if (seed === 'showcase') Object.assign(source, { listContacts: showcaseContacts })
  if (seed === 'stress') Object.assign(source, { listContacts: stressContacts })
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const plan = { realistic, stress, zones, showcase }[seed]
  const planned = await plan(source, today)
  if (!params.has('empty')) {
    await Promise.all(planned.map(([calendar, event]) => source.createEvent(calendar, event)))
  }
  setApi(new Registry(buildSource, [source]))
  const theme = params.get('theme')
  return theme === 'dark' || theme === 'light' ? { ...settingsOf[seed], theme } : settingsOf[seed]
}
