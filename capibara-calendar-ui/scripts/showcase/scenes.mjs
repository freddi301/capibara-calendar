import { join } from 'node:path'
import {
  beat,
  centerOf,
  choose,
  fillIn,
  finger,
  playButton,
  reveal,
  scroll,
  tap,
  write,
} from './helpers.mjs'

// The storyboard of the video, scene by scene (the numbers are the ones of the plan in the chat).
// Each scene acts like a user: it taps and scrolls, and it waits so that the viewer can follow.

const dayLabel = (offset) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.now() + offset * 86_400_000))

const dayButton = (page, offset) =>
  page.getByRole('button', { name: new RegExp(`^${dayLabel(offset)}`) }).first()

/** A button of the bar at the bottom (the event cards can have the same words in their text). */
const bar = (page, name) => page.getByRole('button', { name, exact: true })

/** The days that were tapped and the scrolling move the date: the agenda goes back to today. */
async function backToToday(page) {
  const today = bar(page, 'Today')
  if ((await today.count()) > 0 && (await today.isEnabled())) await tap(page, today, 1200)
}

async function chooseLayout(page, name, after = 900) {
  await tap(page, page.getByRole('button', { name: 'Layouts' }), 1300)
  await tap(page, page.getByRole('button', { name, exact: true }), after)
}

/** Not recorded in the GIF (the start of the video is cut): the app opens on the agenda. */
export async function setup(page, url) {
  await page.goto(url)
  await page.getByRole('button', { name: 'Layouts' }).waitFor()
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name: 'Agenda', exact: true }).click()
  await page
    .getByRole('button', { name: /^Team standup/ })
    .first()
    .waitFor()
  await beat(page, 600)
}

/** The card that is dragged in the week rows, and the row of the next day to drop it on. */
async function dentistAndTarget(page) {
  const rows = page.getByRole('group', { name: /, \d{4}$/ })
  const card = page.getByRole('button', { name: /Dentist/ }).first()
  await reveal(card)
  await beat(page, 500)
  const index = await rows.evaluateAll(
    (elements, own) => elements.findIndex((row) => row.contains(own)),
    await card.elementHandle(),
  )
  return { card, target: rows.nth(index + 1 < (await rows.count()) ? index + 1 : index - 1) }
}

/**
 * The pictures of the README, one file for each, in the order that they cycle: the screens, each
 * with the play button of the video over it. They are made before the video, in their own browser.
 */
export async function shootPoster(page, url, folder) {
  const shoot = async (number) => {
    await beat(page, 600)
    await playButton(page)
    await page.screenshot({ path: join(folder, `poster-${String(number)}.png`), scale: 'css' })
    await playButton(page, false)
  }
  await setup(page, url)

  await chooseLayout(page, 'Timeline week', 1500)
  await shoot(1)

  await chooseLayout(page, 'Agenda', 1200)
  await shoot(2)

  // The card is in the air over another day, with the day marked, and it is let go after.
  await chooseLayout(page, 'Week', 1200)
  const { card, target } = await dentistAndTarget(page)
  const dragging = await finger(page)
  await dragging.drag(await centerOf(card), await centerOf(target), false)
  await shoot(3)
  await dragging.release()
  await beat(page, 800)

  await chooseLayout(page, 'Days', 1000)
  await tap(page, page.getByRole('button', { name: 'Show the month' }), 1200)
  await shoot(4)

  await chooseLayout(page, 'Agenda', 1000)
  await tap(page, page.getByRole('button', { name: /^Sprint planning/ }).first(), 1500)
  await shoot(5)
}

export const scenes = [
  [
    '1 Agenda',
    async (page) => {
      await beat(page, 900)
      await scroll(page, 600, 1400)
      await beat(page, 400)
      await scroll(page, -600, 1000)
    },
  ],

  [
    '2 Event detail',
    async (page) => {
      await tap(page, page.getByRole('button', { name: /^Sprint planning/ }).first(), 1400)
      await scroll(page, 500, 1200)
      await beat(page, 600)
      await scroll(page, -500, 900)
      await tap(page, page.getByRole('button', { name: 'Back' }), 700)
    },
  ],

  ['3 Layout switcher', (page) => chooseLayout(page, 'Week', 1000)],

  [
    '4 Week rows',
    async (page) => {
      await scroll(page, 450, 1300)
      await beat(page, 400)
      await scroll(page, -450, 1000)
    },
  ],

  [
    '5 Week rows, drag and drop',
    async (page) => {
      const { card, target } = await dentistAndTarget(page)
      await (await finger(page)).drag(await centerOf(card), await centerOf(target))
      await beat(page, 2200)
    },
  ],

  [
    '6 Days, week strip',
    async (page) => {
      await chooseLayout(page, 'Days')
      await tap(page, dayButton(page, 2), 1100)
      await tap(page, dayButton(page, 3), 1100)
    },
  ],

  [
    '7 Days, month table',
    async (page) => {
      await tap(page, page.getByRole('button', { name: 'Show the month' }), 1200)
      await tap(page, dayButton(page, 9), 1200)
      await tap(page, page.getByRole('button', { name: 'Show the week' }), 900)
    },
  ],

  [
    '8 Timeline day',
    async (page) => {
      await chooseLayout(page, 'Timeline day', 1000)
      await scroll(page, 500, 1400)
      await beat(page, 400)
      await scroll(page, -500, 1000)
    },
  ],

  [
    '9 Timeline week',
    async (page) => {
      await chooseLayout(page, 'Timeline week', 1000)
      await scroll(page, 500, 1400)
      await beat(page, 400)
      await scroll(page, -500, 1000)
    },
  ],

  [
    '10 Timeline month',
    async (page) => {
      await chooseLayout(page, 'Timeline month', 1400)
      await scroll(page, 400, 1200)
      await beat(page, 400)
      await scroll(page, 700, 1600, 'x')
      await beat(page, 400)
      await scroll(page, -700, 1200, 'x')
      await beat(page, 400)
      await chooseLayout(page, 'Agenda', 1200)
      await backToToday(page)
    },
  ],

  [
    '11 Create event',
    async (page) => {
      const field = (name) => page.getByRole('textbox', { name, exact: true })
      await tap(page, bar(page, 'New event'), 1000)
      await write(page, field('Title'), 'Dinner with Sofia')
      await choose(page, page.getByRole('combobox', { name: 'Calendar', exact: true }), 'Family')
      await fillIn(page, field('Start time'), '19:00')
      await fillIn(page, field('End time'), '21:00')
      await choose(page, page.getByRole('combobox', { name: 'Repeat', exact: true }), 'Week')
      await write(page, field('Location'), 'Trattoria da Luigi')
      await tap(page, page.getByRole('button', { name: 'Add attendee', exact: true }), 1000)
      await tap(page, page.getByRole('button', { name: 'Sofia Romano', exact: true }), 900)
      const dialog = page.getByRole('dialog', { name: 'Add attendee' })
      if (await dialog.isVisible()) await tap(page, dialog.getByRole('button', { name: 'Close' }))
      await tap(page, page.getByRole('button', { name: 'Save', exact: true }), 1200)
      const created = page.getByRole('button', { name: /^Dinner with Sofia/ }).first()
      await created.waitFor()
      await reveal(created)
      await beat(page, 1500)
    },
  ],

  [
    '12 Event menu',
    async (page) => {
      const event = page.getByRole('button', { name: /^Product sync/ }).first()
      await reveal(event)
      await (await finger(page)).hold(await centerOf(event))
      await page.getByRole('dialog', { name: 'Product sync' }).waitFor()
      await beat(page, 1800)
      await page.keyboard.press('Escape')
      await beat(page, 800)
    },
  ],

  [
    '13 Filters',
    async (page) => {
      await tap(page, bar(page, 'Filter'), 1000)
      await tap(page, page.getByRole('button', { name: 'Add rule' }), 900)
      await tap(page, page.getByRole('menuitem', { name: 'Title contains…' }), 700)
      await write(page, page.getByRole('textbox', { name: 'Title', exact: true }), 'review', 900)
      await tap(page, page.getByRole('button', { name: 'Back' }), 1800)
      await tap(page, bar(page, 'Filter'), 900)
      await tap(page, page.getByRole('button', { name: 'Reset' }), 700)
      await tap(page, page.getByRole('button', { name: 'Back' }), 1000)
    },
  ],

  [
    '14 View',
    async (page) => {
      const description = page.getByRole('checkbox', { name: 'Description', exact: true })
      await tap(page, bar(page, 'What to view'), 1000)
      await tap(page, description, 800)
      await tap(page, page.getByRole('button', { name: 'Back' }), 1800)
      await tap(page, bar(page, 'What to view'), 900)
      await tap(page, description, 800)
      await tap(page, page.getByRole('button', { name: 'Back' }), 1000)
    },
  ],

  [
    '15 Calendars',
    async (page) => {
      const sport = page.getByRole('switch', { name: 'Sport', exact: true })
      await tap(page, bar(page, 'Calendars'), 1200)
      await tap(page, sport, 800)
      await tap(page, page.getByRole('button', { name: 'Back' }), 1800)
      await tap(page, bar(page, 'Calendars'), 900)
      await tap(page, sport, 800)
      await tap(page, page.getByRole('button', { name: 'Back' }), 1000)
    },
  ],

  [
    '16 Settings',
    async (page) => {
      await tap(page, bar(page, 'Settings'), 1500)
      await scroll(page, 400, 1200)
      await beat(page, 500)
      await scroll(page, -400, 900)
      await tap(page, page.getByRole('button', { name: 'Back' }), 1200)
    },
  ],
]
