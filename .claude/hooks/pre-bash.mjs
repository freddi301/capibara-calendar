// PreToolUse hook for Bash: it saves tokens.
// A shell command that reads, searches or edits files is refused when a tool made for that exists
// (Read, Grep, Glob, Edit, Write, Serena). The reason is sent to stderr with exit code 2.
// Filters at the end of a pipe (npm test | tail -5) and redirects of output to a log are allowed.
// A command that really needs the shell can say so with the comment: # allow-shell-edit

const bypass = '# allow-shell-edit'
// Set to true when the session has Grep and Glob, or Serena search_for_pattern and find_file.
// Until then grep and find are the only way to search, so they are not refused.
const hasSearchTools = false

let input
try {
  input = JSON.parse(await new Response(process.stdin).text())
} catch {
  process.exit(0)
}
const raw = input?.tool_input?.command
if (typeof raw !== 'string' || raw.includes(bypass)) process.exit(0)

const reasons = {
  read: 'Use the Read tool (offset and limit) to read a file. To look for text, use Grep.',
  grep: 'Use the Grep tool. For the usages of a symbol use Serena (find_referencing_symbols, find_symbol).',
  find: 'Use the Glob tool to find files by name.',
  sedInPlace:
    'Use the Edit tool (replace_all for many occurrences). To rename across files use Serena (rename_symbol).',
  sedRead: 'Use the Read tool (offset and limit) or Grep instead of sed or awk on a file.',
  write: 'Use the Write tool for a new file, and Edit for an existing one, instead of shell redirects.',
  scriptWrite: 'Use the Edit tool (replace_all for many occurrences) instead of a script that rewrites files.',
  scriptRead: 'Use the Read tool or Grep instead of a script that reads files.',
}

// The text of the command without the parts that only look like commands.
const skeleton = raw
  .replace(
    /<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g,
    '<<HEREDOC$3',
  )
  .replace(/'[^']*'/g, '""')
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')

const stages = skeleton
  .split(/\n|&&|;|\|\|/)
  .map((command) =>
    command.split('|').map((text, index) => ({ text, words: wordsOf(text), isFilter: index > 0 })),
  )
  .flat()
  .filter(({ words }) => words.length > 0)

function wordsOf(stage) {
  const words = stage.trim().split(/\s+/).filter(Boolean)
  while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift()
  while (words.length > 0 && ['sudo', 'time', 'command', 'nohup'].includes(words[0])) words.shift()
  return words
}

const hasFile = (args) => args.some((arg) => !/^[-<>]/.test(arg) && !/^\d+$/.test(arg))
// For sed and awk the first word that is not an option is the script, the next ones are files.
const hasScriptFile = (args) => args.filter((arg) => !arg.startsWith('-')).length > 1
const hasRedirectToFile = (text) => /(^|[^0-9&>])>>?\s*(?!&|\/dev\/null)[^\s&]/.test(text)
const interpreters = ['python', 'python3', 'node', 'deno', 'bun', 'ruby', 'perl']
const writesFiles = /write_text|write_bytes|\.write\(|writeFile|appendFile|open\([^)]*,\s*['"][wa]b?\+?['"]|rename\(|unlink\(/
const readsFiles = /read_text|read_bytes|readFile|open\([^)]*\)\.read|open\(['"][^'"]+['"]\)/

function refusal({ words, isFilter, text: stageText }) {
  const [name, ...rest] = words
  const args = name === 'git' ? words.slice(2) : rest
  if (name === 'git' && words[1] === 'grep' && hasSearchTools) return reasons.grep
  if (['cat', 'head', 'tail', 'less', 'more', 'bat', 'nl', 'tac'].includes(name)) {
    if (name === 'cat' && hasRedirectToFile(stageText)) return reasons.write
    return !isFilter && hasFile(args) ? reasons.read : undefined
  }
  if (['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack'].includes(name)) {
    return isFilter || !hasSearchTools ? undefined : reasons.grep
  }
  if (name === 'find' && hasSearchTools) {
    const needsShell = /^-(exec|execdir|ok|delete|mtime|mmin|atime|ctime|newer|size|perm|user|group|empty|maxdepth|print0|printf)/
    return isFilter || rest.some((arg) => needsShell.test(arg)) ? undefined : reasons.find
  }
  if (name === 'sed') {
    if (rest.some((arg) => /^-[a-zA-Z]*i|^--in-place/.test(arg))) return reasons.sedInPlace
    return !isFilter && hasScriptFile(rest) ? reasons.sedRead : undefined
  }
  if (['awk', 'gawk', 'mawk'].includes(name)) return !isFilter && hasScriptFile(rest) ? reasons.sedRead : undefined
  if (['echo', 'printf'].includes(name)) return hasRedirectToFile(stageText) ? reasons.write : undefined
  if (['perl', 'ruby'].includes(name) && rest.some((arg) => /^-[a-zA-Z]*i/.test(arg))) return reasons.sedInPlace
  if (name === 'sd') return reasons.sedInPlace
  return undefined
}

let reason
for (const stage of stages) {
  reason = refusal(stage)
  if (reason) break
}

if (!reason) {
  const name = stages.map(({ words }) => words[0]).find((word) => interpreters.includes(word))
  if (name && writesFiles.test(raw)) reason = reasons.scriptWrite
  else if (name && /\s-[ce]\b|<<|\s-\s*$/.test(raw) && readsFiles.test(raw)) reason = reasons.scriptRead
}

if (reason) {
  console.error(`Shell command refused. ${reason} If the shell is really needed, add "${bypass}" to the command.`)
  process.exit(2)
}
