// Puts one event for each way that "when" of an event can be, in the calendar `calendar`, to look at
// the screen of an event: a whole day, many days, times in a day, times over more than a day, and so on.
// The days are counted from today. It can be run again: the events have fixed ids, so they are replaced.
//
//   node scripts/seed-event-variants.mjs [http://localhost:5232] [user:password]
const server = process.argv[2] ?? 'http://localhost:5232'
const [user, password] = (process.argv[3] ?? 'dev:dev').split(':')
const auth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
const slug = 'calendar'

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

await call(
  `/${user}/${slug}/`,
  'MKCALENDAR',
  `<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:I="http://apple.com/ns/ical/"><D:set><D:prop>
     <D:displayname>Calendar</D:displayname><I:calendar-color>#2563eb</I:calendar-color>
     <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
   </D:prop></D:set></C:mkcalendar>`,
  { 'Content-Type': 'application/xml' },
)

const pad = (value) => String(value).padStart(2, '0')
const today = new Date()
today.setHours(0, 0, 0, 0)
const dayText = (offset) => {
  const day = new Date(today)
  day.setDate(day.getDate() + offset)
  return `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}`
}
// A day is a number of days from today, or a date as 'YYYYMMDD'.
const dateOf = (day) => (typeof day === 'number' ? dayText(day) : day)
const escape = (text) => text.replace(/([\;,])/g, '\\$1').replace(/\n/g, '\\n')

const jobs = []
let count = 0

/**
 * An event. With `start` (as 'HH:mm') it has times, and with `end` too; with none it lasts whole days,
 * from `day` to `endDay` (the last of them).
 */
function add({
  day,
  start,
  end,
  endDay = day,
  title,
  place,
  tags,
  description,
  link,
  reminder,
  repeat,
}) {
  count += 1
  const uid = `variant-${String(count).padStart(2, '0')}@capibara`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//capibara variants//EN',
    'BEGIN:VEVENT',
  ]
  lines.push(`UID:${uid}`, 'DTSTAMP:20260101T000000Z')
  if (start) {
    lines.push(`DTSTART:${dateOf(day)}T${start.replace(':', '')}00`)
    if (end) lines.push(`DTEND:${dateOf(endDay)}T${end.replace(':', '')}00`)
  } else {
    const last = new Date(
      Number(dateOf(endDay).slice(0, 4)),
      Number(dateOf(endDay).slice(4, 6)) - 1,
      Number(dateOf(endDay).slice(6)) + 1,
    )
    lines.push(`DTSTART;VALUE=DATE:${dateOf(day)}`)
    // The end of an event of whole days is the day after its last one.
    lines.push(
      `DTEND;VALUE=DATE:${last.getFullYear()}${pad(last.getMonth() + 1)}${pad(last.getDate())}`,
    )
  }
  // A double letter before each title (AA, BB, CC...): it is easy to say which one is meant.
  const code = String.fromCharCode(64 + count).repeat(2)
  lines.push(`SUMMARY:${escape(`${code} ${title}`)}`)
  if (place) lines.push(`LOCATION:${escape(place)}`)
  if (tags) lines.push(`CATEGORIES:${tags.map(escape).join(',')}`)
  if (description) lines.push(`DESCRIPTION:${escape(description)}`)
  if (link) lines.push(`CONFERENCE;VALUE=URI:${link}`)
  if (repeat) lines.push(`RRULE:${repeat}`)
  if (reminder) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:r',
      `TRIGGER:-PT${reminder}M`,
      'END:VALARM',
    )
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  jobs.push({ uid, ics: lines.join('\r\n') + '\r\n' })
}

// One day, whole.
add({ day: 1, title: 'All day · one day' })
// Whole days, from the first to the last.
add({ day: 3, endDay: 5, title: 'All day · three days' })
add({ day: 7, endDay: 13, title: 'All day · a whole week', place: 'Cabin by the lake' })
add({ day: '20261230', endDay: '20270102', title: 'All day · over the new year' })

// Times in one day.
add({
  day: 2,
  start: '10:00',
  end: '13:00',
  title: 'Same day · from 10:00 to 13:00',
  place: 'Main building',
})
add({ day: 2, start: '14:00', end: '14:15', title: 'Same day · fifteen minutes' })
add({ day: 4, start: '09:30', title: 'Same day · only a start' })
add({ day: 4, start: '23:45', title: 'Same day · only a start, late' })
add({ day: 6, start: '09:00', end: '18:00', title: 'Same day · the whole workday' })
add({ day: 6, start: '00:00', end: '23:59', title: 'Same day · from midnight to midnight' })

// Times over more than a day.
add({ day: 8, start: '22:00', end: '02:00', endDay: 9, title: 'Over midnight · 22:00 to 02:00' })
add({ day: 10, start: '14:30', end: '11:00', endDay: 11, title: 'Two days · with times' })
add({ day: 14, start: '17:00', end: '20:00', endDay: 16, title: 'A long weekend · with times' })
add({
  day: '20261231',
  start: '23:00',
  end: '01:00',
  endDay: '20270101',
  title: 'Over the new year · with times',
})

// With what else an event can have.
add({
  day: 5,
  start: '18:00',
  end: '19:30',
  title: 'With everything · weekly, with a place, tags and a link',
  place: 'Room 4, second floor',
  tags: ['team', 'weekly'],
  link: 'https://meet.example.org/team',
  reminder: 15,
  description: 'The agenda is in the shared document.\nBring the numbers of the month.',
  repeat: 'FREQ=WEEKLY;COUNT=6',
})
add({
  day: 12,
  start: '08:00',
  end: '17:30',
  title:
    'A title that is long enough to go over more than one line of the screen, to see how it looks with the times',
})

for (const { uid, ics } of jobs) {
  await call(`/${user}/${slug}/${uid}.ics`, 'PUT', ics, { 'Content-Type': 'text/calendar' })
}
console.log(`${jobs.length} events in ${slug}`)
