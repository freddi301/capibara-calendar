// The checks that close a change, in one go and with short output, for AI agents (npm run check:agent).
// Each tool gets one line, and the ones that fail show their first errors only (no warnings).
// The messages are extracted first, and Lingui says how many of them have no Italian translation.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const maxLines = 15

const run = (command, args) => spawnSync(command, args, { encoding: 'utf8' })
const linesOf = ({ stdout, stderr }) => `${stdout}${stderr}`.split('\n')

// The "Missing" column of the row of Italian, in the table that `lingui extract` prints.
const missingItalian = (lines) =>
  Number(
    lines
      // eslint-disable-next-line no-control-regex
      .map((line) => line.replace(/\x1b\[[0-9;]*m/g, ''))
      .map((line) => /│\s*it\s*│\s*\d+\s*│\s*(\d+)\s*│/.exec(line)?.[1])
      .find(Boolean) ?? 0,
  )

// Lingui counts them only: the messages with an empty translation are read from the catalog.
const untranslated = () =>
  readFileSync('src/locales/it/messages.po', 'utf8')
    .split('\n\n')
    .map((entry) => /(?:^|\n)msgid "(.+)"\nmsgstr ""\s*$/.exec(entry)?.[1])
    .filter(Boolean)

// The files that are changed or new, as the shell sees them from this folder.
const formattable = /\.(tsx?|jsx?|mjs|cjs|json|jsonc|css|html|md)$/
const changed = [
  ...linesOf(run('git', ['diff', '--name-only', '--diff-filter=d', '--relative', 'HEAD'])),
  ...linesOf(run('git', ['ls-files', '--others', '--exclude-standard'])),
].filter((file) => formattable.test(file))

const tools = [
  {
    name: 'extract',
    args: ['lingui', 'extract', '--clean'],
    show: (lines) => lines.filter((line) => /error/i.test(line)),
    problems: (lines) =>
      missingItalian(lines) === 0
        ? []
        : [
            `${missingItalian(lines)} Italian messages missing: write them in src/locales/it/messages.po`,
            ...untranslated(),
          ],
  },
  {
    name: 'tsc',
    args: ['tsc', '-b', '--pretty', 'false'],
    show: (lines) => lines.filter((line) => /error TS\d+/.test(line)),
  },
  {
    name: 'eslint',
    args: ['eslint', '--quiet', '.'],
    show: (lines) => lines.filter((line) => /^\/|\berror\b/.test(line)),
  },
  { name: 'knip', args: ['knip', '--no-progress'], show: (lines) => lines.filter(Boolean) },
  {
    name: 'prettier (formats changed files)',
    args: ['prettier', '--write', '--log-level', 'warn', '--ignore-unknown', ...changed],
    skip: changed.length === 0,
    show: (lines) => lines.filter(Boolean),
  },
]

let failed = false
for (const { name, args, show, problems, skip } of tools) {
  if (skip) continue
  const result = run('npx', ['--no-install', ...args])
  // A tool that ends well can still have found problems, that it does not fail on.
  const shown = result.status === 0 ? (problems?.(linesOf(result)) ?? []) : show(linesOf(result))
  if (result.status === 0 && shown.length === 0) {
    console.log(`ok   ${name}`)
    continue
  }
  failed = true
  console.log(
    `FAIL ${name}${shown.length > maxLines ? ` (first ${maxLines} of ${shown.length})` : ''}`,
  )
  for (const line of shown.slice(0, maxLines)) console.log(`  ${line}`)
}
process.exit(failed ? 1 : 0)
