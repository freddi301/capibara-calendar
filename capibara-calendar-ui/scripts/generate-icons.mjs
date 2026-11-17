import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const masterPath = join(root, 'app-icon.svg')
const master = readFileSync(masterPath, 'utf8')

const inner = master.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

const background = `<defs><linearGradient id="icon-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#042f35"/><stop offset="1" stop-color="#4a0d35"/></linearGradient></defs><rect width="64" height="64" fill="url(#icon-bg)"/>`

const padded = (scale) => {
  const offset = (64 - 64 * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${background}<g transform="translate(${offset} ${offset}) scale(${scale})">${inner}</g></svg>`
}

const temporary = mkdtempSync(join(tmpdir(), 'app-icons-'))
const render = (svg, size, output) => {
  const input = join(temporary, 'input.svg')
  writeFileSync(input, svg)
  const target = join(root, output)
  mkdirSync(dirname(target), { recursive: true })
  const { status, stderr, error } = spawnSync(
    'rsvg-convert',
    ['-w', String(size), '-h', String(size), input, '-o', target],
    {
      encoding: 'utf8',
    },
  )
  if (status !== 0) {
    throw new Error(`rsvg-convert failed for ${output}: ${error?.message ?? stderr}`)
  }
  console.log(`${output} (${size}x${size})`)
}

try {
  copyFileSync(masterPath, join(root, 'public/favicon.svg'))
  console.log('public/favicon.svg')

  render(master, 192, 'public/icons/icon-192.png')
  render(master, 512, 'public/icons/icon-512.png')
  render(padded(0.56), 512, 'public/icons/icon-maskable-512.png')
  render(padded(0.76), 180, 'public/icons/apple-touch-icon.png')
  render(master, 512, 'public-webxdc/icon.png')
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
