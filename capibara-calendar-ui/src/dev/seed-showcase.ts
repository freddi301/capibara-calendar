import { range } from 'es-toolkit'
import { contactId, type CalendarSource, type Contact } from '../api/calendar-api'
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

const everybody = [
  ['anna', 'Anna Rossi'],
  ['marco', 'Marco Bianchi'],
  ['giulia', 'Giulia Verdi'],
  ['luca', 'Luca Neri'],
  ['sofia', 'Sofia Romano'],
]

/** The address book of the contact picker: the memory source has none. */
export const showcaseContacts = (): Promise<Contact[]> =>
  Promise.resolve(
    everybody.map(([name, full]) => ({ id: contactId(`mailto:${name}@example.com`), name: full })),
  )

const fillers = [
  'Coffee with Luca',
  'Code review',
  'Groceries',
  'Invoice check',
  'Call the bank',
  'Book club',
  'Language class',
  'Haircut',
  'Team lunch',
  'Plan the trip',
]

export async function showcase(source: CalendarSource, today: Day): Promise<Planned[]> {
  const [work, personal, family, sport] = await calendars(source, [
    'Work',
    'Personal',
    'Family',
    'Sport',
  ])
  const day = (offset: number) => today.add({ days: offset })
  // The series start on a day that they repeat on, two weeks ago, so that they fill the month.
  const monday = today.subtract({ days: today.dayOfWeek - 1 + 14 })

  const series: Planned[] = [
    [
      work,
      timed(monday, '09:30', 'PT15M', {
        title: 'Team standup',
        description: 'What I did, what I will do, what blocks me. Fifteen minutes, standing.',
        keywords: ['meeting'],
        recurrenceRules: [{ frequency: 'weekly', byDay: weekdays }],
      }),
    ],
    [
      sport,
      timed(monday.add({ days: 1 }), '18:30', 'PT1H', {
        title: 'Yoga',
        description: 'Bring the mat and a bottle of water.',
        keywords: ['fitness'],
        recurrenceRules: [{ frequency: 'weekly', byDay: [{ day: 'tu' }, { day: 'th' }] }],
      }),
    ],
    [
      sport,
      timed(monday.add({ days: 5 }), '10:00', 'PT2H', {
        title: 'Five-a-side football',
        keywords: ['fitness', 'friends'],
        recurrenceRules: [{ frequency: 'weekly', byDay: [{ day: 'sa' }] }],
      }),
    ],
    [
      family,
      timed(monday.add({ days: 6 }), '13:00', 'PT2H', {
        title: 'Sunday lunch',
        description: "At grandma's. Mum brings the dessert.",
        keywords: ['family'],
        recurrenceRules: [{ frequency: 'weekly', byDay: [{ day: 'su' }] }],
      }),
    ],
    [
      work,
      timed(monday.add({ days: 2 }), '10:00', 'PT1H30M', {
        title: 'Sprint planning',
        description: 'Bring the estimates for the import screen, and the open bugs of the week.',
        locations: [{ name: 'Room 2B' }],
        keywords: ['meeting', 'important'],
        participants: people(['anna', 'marco', 'giulia']),
        alerts: [reminder('-PT15M')],
        recurrenceRules: [{ frequency: 'weekly', byDay: [{ day: 'we' }] }],
      }),
    ],
  ]

  const events: Planned[] = [
    // Today, with two events that overlap, for the timeline.
    [
      work,
      timed(day(0), '11:00', 'PT1H', {
        title: 'Design review',
        description: 'Walk through the new event form and collect the feedback.',
        keywords: ['meeting', 'design'],
        locations: [{ name: 'Room 2B' }],
      }),
    ],
    [work, timed(day(0), '11:30', 'PT1H', { title: 'Product sync', keywords: ['meeting'] })],
    [
      personal,
      timed(day(0), '12:30', 'PT1H', {
        title: 'Lunch with Anna',
        description: 'She wants to talk about the trip in spring.',
        keywords: ['friends'],
      }),
    ],
    [
      work,
      timed(day(0), '15:00', 'PT45M', {
        title: 'Call with supplier',
        description: 'Ask for the new price list, and for the delivery dates.',
        keywords: ['important'],
      }),
    ],
    [personal, timed(day(0), '20:30', 'PT2H', { title: 'Cinema with Marco' })],
    // The one that is dragged to another day in the week rows: early, so that it is the first card
    // of its day, the one that is on the screen (a row shows two cards, the others scroll).
    [
      personal,
      timed(day(1), '08:15', 'PT1H', {
        title: 'Dentist',
        description: 'Yearly check-up. Bring the health card.',
        keywords: ['health'],
        status: 'tentative',
      }),
    ],
    [
      family,
      allDay(day(2), 1, {
        title: "Mum's birthday",
        description: 'Cake from the bakery in the square, and the flowers.',
        keywords: ['family'],
      }),
    ],
    [
      work,
      timed(day(2), '14:00', 'PT2H', {
        title: 'Design workshop',
        description: 'Sketch the month view with the team.',
        keywords: ['design'],
      }),
    ],
    [work, timed(day(3), '10:00', 'PT1H', { title: 'Product demo', keywords: ['meeting'] })],
    [personal, timed(day(3), '17:00', 'PT1H', { title: 'Piano lesson' })],
    [
      family,
      allDay(day(4), 3, {
        title: 'Weekend in the mountains',
        description: 'Leave on Friday morning. The cabin key is with the neighbour.',
        keywords: ['travel', 'family'],
      }),
    ],
    [
      work,
      timed(day(4), '11:00', 'PT1H', {
        title: 'Quarterly review',
        description: 'Results of the quarter and the plan for the next one.',
        keywords: ['meeting', 'important'],
        virtualLocations: [{ uri: 'https://meet.example.com/quarterly' }],
      }),
    ],
    [
      work,
      allDay(day(8), 2, {
        title: 'Marketing offsite',
        description: 'Two days outside the office, planning the next campaigns.',
        keywords: ['travel'],
      }),
    ],
    [
      sport,
      timed(day(9), '09:00', 'PT4H', {
        title: 'Hike',
        description: 'Easy trail by the lake. Packed lunch.',
        keywords: ['fitness', 'friends'],
      }),
    ],
    [work, timed(day(-2), '14:00', 'PT2H', { title: 'Workshop' })],
    [work, timed(day(-1), '16:00', 'PT1H', { title: 'Retrospective' })],
  ]

  // A little on most of the other days, for the month views.
  const small = range(-10, 25)
    .filter((offset) => offset % 3 !== 0)
    .map((offset): Planned => [
      [personal, work, family, sport][Math.abs(offset) % 4],
      timed(day(offset), offset % 2 === 0 ? '13:30' : '18:00', 'PT45M', {
        title: fillers[Math.abs(offset) % fillers.length],
      }),
    ])

  return [...series, ...events, ...small]
}
