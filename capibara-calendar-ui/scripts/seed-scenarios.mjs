// Fills the local Radicale with events for many scenarios of the timeline layouts: different
// durations, densities and overlaps. The days are counted from today. It can be run again: the
// events have fixed ids, so they are replaced, not added.
//
//   node scripts/seed-scenarios.mjs [http://localhost:5232] [user:password]
const server = process.argv[2] ?? 'http://localhost:5232'
const [user, password] = (process.argv[3] ?? 'dev:dev').split(':')
const auth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`

const calendars = [
  { slug: 'scenarios', name: 'Scenarios', color: '#2563eb' },
  { slug: 'scenarios-b', name: 'Scenarios B', color: '#db2777' },
]

async function call(path, method, body, headers = {}) {
  const response = await fetch(`${server}${path}`, {
    method,
    body,
    headers: { Authorization: auth, ...headers },
  })
  // A calendar that is there already is as it should be (405 or 409).
  if (
    !response.ok &&
    response.status !== 405 &&
    !(method === 'MKCALENDAR' && response.status === 409)
  ) {
    throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`)
  }
}

for (const { slug, name, color } of calendars) {
  await call(
    `/${user}/${slug}/`,
    'MKCALENDAR',
    `<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:I="http://apple.com/ns/ical/"><D:set><D:prop>
       <D:displayname>${name}</D:displayname><I:calendar-color>${color}</I:calendar-color>
       <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
     </D:prop></D:set></C:mkcalendar>`,
    { 'Content-Type': 'application/xml' },
  )
}

const pad = (value) => String(value).padStart(2, '0')
const today = new Date()
today.setHours(0, 0, 0, 0)
const dayText = (offset) => {
  const day = new Date(today)
  day.setDate(day.getDate() + offset)
  return `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}`
}
const stamp = (offset, time) => `${dayText(offset)}T${time.replace(':', '')}00`
const escape = (text) => text.replace(/([\;,])/g, '\\$1').replace(/\n/g, '\\n')

let count = 0
const jobs = []

/** A timed event of the day (counted from today): start and end as 'HH:mm', the end maybe on a later day. */
function add({ day, start, end, endDay = day, title, calendar = 'scenarios', ...more }) {
  count += 1
  const uid = `scenario-${String(count).padStart(4, '0')}@capibara`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//capibara scenarios//EN',
    'BEGIN:VEVENT',
  ]
  lines.push(`UID:${uid}`, `DTSTAMP:20260101T000000Z`)
  if (start) {
    lines.push(`DTSTART:${stamp(day, start)}`)
    if (end) lines.push(`DTEND:${stamp(endDay, end)}`)
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dayText(day)}`)
    lines.push(`DTEND;VALUE=DATE:${dayText(endDay + 1)}`) // the end of an all-day event is the next day
  }
  lines.push(`SUMMARY:${escape(title)}`)
  if (more.place) lines.push(`LOCATION:${escape(more.place)}`)
  if (more.tags) lines.push(`CATEGORIES:${more.tags.map(escape).join(',')}`)
  if (more.description) lines.push(`DESCRIPTION:${escape(more.description)}`)
  if (more.repeat) lines.push(`RRULE:${more.repeat}`)
  if (more.reminder) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:r',
      `TRIGGER:-PT${more.reminder}M`,
      'END:VALARM',
    )
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  jobs.push({ calendar, uid, ics: lines.join('\r\n') + '\r\n' })
}

const at = (hours, minutes = 0) => `${pad(hours)}:${pad(minutes)}`
const plus = (start, minutes) => {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + minutes
  return at(Math.floor(total / 60) % 24, total % 60)
}

// 1. A dense day: events one after the other, 45 minutes each, with no gap, from 08:00 to 17:00.
for (let index = 0; index < 12; index++) {
  const start = plus('08:00', index * 45)
  add({ day: 1, start, end: plus(start, 45), title: `Back to back ${index + 1}` })
}

// 2. The same hour for eight events, in two calendars: eight columns, more than are across.
for (let index = 0; index < 8; index++) {
  add({
    day: 2,
    start: '10:00',
    end: '11:00',
    title: `Same hour ${index + 1}`,
    calendar: index % 2 ? 'scenarios-b' : 'scenarios',
  })
}

// 3. A staircase: one starts every half hour and lasts two hours: four events overlap each other.
for (let index = 0; index < 8; index++) {
  const start = plus('09:00', index * 30)
  add({ day: 3, start, end: plus(start, 120), title: `Staircase ${index + 1}` })
}

// 4. Short events: 5, 10, 15 and 20 minutes, close to each other: their blocks overlap, their time does not.
;[5, 10, 15, 20, 5, 10, 15, 20].forEach((minutes, index) => {
  const start = plus('09:00', index * 25)
  add({ day: 4, start, end: plus(start, minutes), title: `Short ${minutes} min` })
})

// 5. Long events: 4, 6 and 9 hours, side by side with short ones.
add({ day: 5, start: '06:00', end: '10:00', title: 'Long four hours', calendar: 'scenarios-b' })
add({ day: 5, start: '09:00', end: '15:00', title: 'Long six hours' })
add({ day: 5, start: '08:00', end: '17:00', title: 'Long nine hours', calendar: 'scenarios-b' })
add({ day: 5, start: '12:00', end: '12:30', title: 'Short one inside' })

// 6. Across midnight, and across days.
add({ day: 6, start: '22:00', end: '02:00', endDay: 7, title: 'Over midnight' })
add({
  day: 8,
  start: '18:00',
  end: '09:00',
  endDay: 10,
  title: 'Three days, with times',
  calendar: 'scenarios-b',
})

// 7. All-day events: one, two on the same day, and some days long.
add({ day: 9, title: 'All day one' })
add({ day: 9, title: 'All day two', calendar: 'scenarios-b' })
add({ day: 9, start: '14:00', end: '15:00', title: 'Timed on an all-day' })
add({ day: 11, endDay: 13, title: 'All day, three days' })

// 8. Events with a start and no end.
for (const [index, time] of ['07:15', '09:30', '09:40', '13:00', '13:05', '18:45'].entries()) {
  add({ day: 14, start: time, title: `Point ${index + 1}` })
}

// 9. Everything that an event can show: place, tags, description, repeat and a reminder.
add({
  day: 15,
  start: '10:00',
  end: '13:00',
  title: 'Rich event with a rather long title that has to wrap to more than one line',
  place: 'Main building, second floor, the big room',
  tags: ['project', 'review', 'important'],
  description: 'A long description. '.repeat(12),
  reminder: 15,
})
add({ day: 15, start: '10:30', end: '11:15', title: 'Rich beside', place: 'Café', tags: ['quick'] })
add({
  day: 15,
  start: '16:00',
  end: '16:30',
  title: 'Ünïcödé — très long titre qui dépasse la place',
})

// 10. Back to back, touching and not overlapping: one column.
add({ day: 16, start: '09:00', end: '10:00', title: 'Touching A' })
add({ day: 16, start: '10:00', end: '11:00', title: 'Touching B' })
add({ day: 16, start: '11:00', end: '12:00', title: 'Touching C' })

// 11. Repeating: every day for a month, every Monday and Thursday, every month.
add({ day: -14, start: '09:30', end: '09:45', title: 'Stand-up', repeat: 'FREQ=DAILY;COUNT=60' })
add({
  day: -14,
  start: '14:00',
  end: '15:30',
  title: 'Planning',
  repeat: 'FREQ=WEEKLY;BYDAY=MO,TH;COUNT=20',
  calendar: 'scenarios-b',
})
add({
  day: 0,
  start: '12:00',
  end: '13:00',
  title: 'Monthly lunch',
  repeat: 'FREQ=MONTHLY;COUNT=12',
})

// 12. Busy weeks: every day from the 18th to the 31st has six to nine events, of many kinds.
let seed = 7
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
for (let day = 18; day <= 31; day++) {
  const many = 6 + Math.floor(random() * 4)
  for (let index = 0; index < many; index++) {
    const start = plus('07:00', Math.floor((random() * 12 * 60) / 15) * 15)
    const length = [15, 30, 45, 60, 90, 120, 180][Math.floor(random() * 7)]
    add({
      day,
      start,
      end: plus(start, length),
      title: `Busy ${day} · ${index + 1}`,
      calendar: random() < 0.4 ? 'scenarios-b' : 'scenarios',
    })
  }
}

// 13. The past: a few events before today, so that going up there is something.
for (const day of [-1, -2, -3, -5, -8, -10, -20, -40]) {
  add({ day, start: '11:00', end: '12:00', title: `Past ${-day} days ago` })
  add({ day, start: '11:30', end: '13:00', title: `Past overlap ${-day}`, calendar: 'scenarios-b' })
}

// 14. Today: a few of them, one that is happening now.
const now = new Date()
const hour = now.getHours()
add({ day: 0, start: at(hour, 0), end: at(Math.min(hour + 2, 23), 30), title: 'Around now' })
add({
  day: 0,
  start: at(Math.max(hour - 3, 0), 0),
  end: at(Math.max(hour - 2, 1), 0),
  title: 'Earlier today',
  calendar: 'scenarios-b',
})
add({ day: 0, start: at(Math.min(hour + 4, 22), 0), end: at(23, 0), title: 'Later today' })

for (const { calendar, uid, ics } of jobs) {
  await call(`/${user}/${calendar}/${uid}.ics`, 'PUT', ics, { 'Content-Type': 'text/calendar' })
}
console.log(`${jobs.length} events in ${calendars.map(({ slug }) => slug).join(', ')}`)
