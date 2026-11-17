// Records the video of the README: `npm run showcase` (with `npm run dev` running).
// It plays the storyboard of `scenes.mjs` on the `?seed=showcase` data, in a phone-sized dark
// browser, with the video of Playwright, and turns the video into an mp4 with ffmpeg. It also
// takes the poster of the video, which is the picture that the README shows.
//
// `npm run showcase -- --only 5,6` plays only those scenes, to work on them (and no poster).
// The video is in `showcase-out/` (not in git): attach `showcase.mp4` to the latest release.
// The poster is `docs/showcase-poster.png`, and it is in git.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const origin = 'http://localhost:5173'
const url = `${origin}/?seed=showcase`
const out = join(import.meta.dirname, '..', '..', 'showcase-out')
const docs = join(import.meta.dirname, '..', '..', '..', 'docs')
const fps = 24

/** Stops the script, with what to install. */
function missing(what, howToInstall) {
  console.error(`\nShowcase: ${what} is missing.\n  ${howToInstall}\n`)
  process.exit(1)
}

async function check() {
  let playwright
  try {
    playwright = await import('@playwright/test')
  } catch {
    missing('the dependency @playwright/test', 'Install the dependencies: npm install')
  }
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).error)
    missing(
      'the program ffmpeg',
      'Install it: sudo apt install ffmpeg | sudo pacman -S ffmpeg | brew install ffmpeg',
    )
  if (!existsSync(playwright.chromium.executablePath()))
    missing('the browser of Playwright (Chromium)', 'Install it: npx playwright install chromium')
  const served = await fetch(url).then(
    (response) => response.ok,
    () => false,
  )
  if (!served) missing(`the dev server on ${origin}`, 'Start it in another terminal: npm run dev')
  return playwright
}

const { chromium, devices } = await check()
const { prepare, beat } = await import('./helpers.mjs')
const { scenes, setup, shootPoster } = await import('./scenes.mjs')

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',')
  : undefined
const played = scenes.filter(([name]) => !only || only.includes(name.split(' ')[0]))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const phone = devices['Pixel 7']
const size = phone.viewport
const browser = await chromium.launch()
const context = await browser.newContext({
  ...phone,
  locale: 'en-US',
  colorScheme: 'dark',
  reducedMotion: 'no-preference',
  recordVideo: { dir: out, size },
})
await prepare(context)
const page = await context.newPage()
const started = Date.now()
await setup(page, url)
const cut = (Date.now() - started) / 1000 // the video starts with the page: this is not for the mp4

for (const [name, play] of played) {
  console.log(`  ${name}`)
  await play(page)
}
await beat(page, 1000) // the last frame stays a moment, so the loop is not abrupt
const video = page.video()
await context.close()
const webm = join(out, 'showcase.webm')
renameSync(await video.path(), webm)

if (!only) {
  const posterContext = await browser.newContext({
    ...phone,
    locale: 'en-US',
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  })
  await prepare(posterContext)
  mkdirSync(docs, { recursive: true })
  await shootPoster(await posterContext.newPage(), url, join(docs, 'showcase-poster.png'))
}
await browser.close()

const mp4 = join(out, 'showcase.mp4')
const converted = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-ss',
    cut.toFixed(2),
    '-i',
    webm,
    // H.264 wants even sides, and 915 is odd.
    '-vf',
    `fps=${String(fps)},scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    '-preset',
    'slow',
    '-movflags',
    '+faststart',
    '-an',
    mp4,
  ],
  { stdio: 'inherit' },
)
if (converted.status !== 0)
  missing('a working ffmpeg with libx264 (the conversion failed)', 'See the error above.')

console.log(`\nShowcase: ${mp4}`)
if (!only) console.log(`Poster: ${join(docs, 'showcase-poster.png')}`)
