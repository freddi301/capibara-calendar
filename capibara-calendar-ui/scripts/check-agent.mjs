// The checks that close a change, in one go and with short output, for AI agents (npm run check:agent).
// Each tool gets one line, and the ones that fail show their first errors only (no warnings).
// The messages are extracted first, so that the Italian catalog test sees the new strings of the UI.
import { spawnSync } from 'node:child_process'

const maxLines = 15

const run = (command, args) => spawnSync(command, args, { encoding: 'utf8' })
const linesOf = ({ stdout, stderr }) => `${stdout}${stderr}`.split('\n')

// The files that are changed or new, as the shell sees them from this folder.
const formattable = /\.(tsx?|jsx?|mjs|cjs|json|jsonc|css|html|md)$/
const changed = [
  ...linesOf(run('git', ['diff', '--name-only', '--diff-filter=d', '--relative', 'HEAD'])),
  ...linesOf(run('git', ['ls-files', '--others', '--exclude-standard'])),
].filter((file) => formattable.test(file))

const tools = [
  {
    name: 'extract',
    args: ['lingui', 'extract'],
    show: (lines) => lines.filter((line) => /error/i.test(line)),
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
  {
    // It says which messages of the Italian catalog are missing or left in English.
    name: 'italian catalog',
    args: ['vitest', 'run', '--reporter=minimal', 'src/test/italian.test.tsx'],
    show: (lines) => lines.filter((line) => /FAIL|Error|Expected|Received|^\s*[-+] /.test(line)),
  },
]

let failed = false
for (const { name, args, show, skip } of tools) {
  if (skip) continue
  const result = run('npx', ['--no-install', ...args])
  if (result.status === 0) {
    console.log(`ok   ${name}`)
    continue
  }
  failed = true
  const shown = show(linesOf(result))
  console.log(
    `FAIL ${name}${shown.length > maxLines ? ` (first ${maxLines} of ${shown.length})` : ''}`,
  )
  for (const line of shown.slice(0, maxLines)) console.log(`  ${line}`)
}
process.exit(failed ? 1 : 0)
