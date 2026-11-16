import { range } from 'es-toolkit'
import { setApi } from '../api'
import {
  contactId,
  duration,
  localDateTime,
  signedDuration,
  sourceId,
  timeZoneId,
  type CalendarRef,
  type CalendarSource,
  type EventValues,
  type Participant,
  type ParticipationStatus,
} from '../api/calendar-api'
import { Registry } from '../api/registry'
import { buildSource } from '../api/sources'
import { activeTimeZone, type Settings } from '../lib/settings'

// Dev only: `?seed=realistic` or `?seed=stress` fills a memory source, for reviewing the layout
// (see LAYOUT-MATRIX.md); with `&empty` it has the calendars but no events. Nothing is saved:
// without the parameter the app is as before.

type Seed = 'realistic' | 'stress'

const settingsOf: Record<Seed, Settings> = {
  realistic: { language: 'en', theme: 'light' },
  stress: { language: 'it', theme: 'dark' },
}

const colors = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04']
const statuses: ParticipationStatus[] = ['accepted', 'needs-action', 'tentative', 'declined']
const weekdays = (['mo', 'tu', 'we', 'th', 'fr'] as const).map((day) => ({ day }))

type Day = Temporal.PlainDate
type Planned = [CalendarRef, EventValues]

function values(changes: Partial<EventValues>): EventValues {
  return {
    title: '',
    description: '',
    start: localDateTime(''),
    timeZone: timeZoneId(activeTimeZone()),
    duration: duration('PT1H'),
    showWithoutTime: false,
    locations: [],
    virtualLocations: [],
    keywords: [],
    alerts: [],
    recurrenceRules: [],
    status: 'confirmed',
    color: null,
    participants: [],
    organizer: null,
    ...changes,
  }
}

const timed = (day: Day, time: string, length: string, changes: Partial<EventValues>) =>
  values({
    start: localDateTime(`${day.toString()}T${time}:00`),
    duration: duration(length),
    ...changes,
  })

const allDay = (day: Day, days: number, changes: Partial<EventValues>) =>
  values({
    start: localDateTime(`${day.toString()}T00:00:00`),
    duration: duration(`P${String(days)}D`),
    showWithoutTime: true,
    timeZone: null,
    ...changes,
  })

const people = (names: string[]): Participant[] =>
  names.map((name, index) => ({
    id: contactId(`mailto:${name}@example.com`),
    status: statuses[index % statuses.length],
  }))

const reminder = (offset: string) => ({
  trigger: {
    type: 'offset' as const,
    offset: signedDuration(offset),
    relativeTo: 'start' as const,
  },
})

async function calendars(source: CalendarSource, names: string[]) {
  const created = await Promise.all(
    names.map((name, index) =>
      source.createCalendar({ name, color: colors[index % colors.length] }),
    ),
  )
  return created.map(({ ref }) => ref)
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
        locations: [{ name: 'Trattoria da Luigi' }],
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
      { name: `Sala riunioni ${noSpaces}` },
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

/** Fills the memory source when the URL asks for a seed, and returns the settings to apply. */
export async function seedFromUrl(): Promise<Settings | undefined> {
  const params = new URLSearchParams(window.location.search)
  const seed = params.get('seed')
  if (seed !== 'realistic' && seed !== 'stress') return undefined
  const source = buildSource(
    { id: sourceId('memory'), kind: 'memory', name: 'Memory', settings: {} },
    {},
  )
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const planned = await (seed === 'stress' ? stress : realistic)(source, today)
  if (!params.has('empty')) {
    await Promise.all(planned.map(([calendar, event]) => source.createEvent(calendar, event)))
  }
  setApi(new Registry(buildSource, [source]))
  return settingsOf[seed]
}
