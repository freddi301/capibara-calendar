// PostToolUse hook: after Claude edits a file in capibara-calendar-ui,
// format it with Prettier, then type-check the whole project with tsc.
// Type errors are sent to stderr with exit code 2 so Claude sees and fixes them.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const maxErrors = 30;
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const appDir = path.join(projectDir, "capibara-calendar-ui");

let input;
try {
  input = JSON.parse(await new Response(process.stdin).text());
} catch {
  process.exit(0);
}

const file = input?.tool_input?.file_path;
if (typeof file !== "string") process.exit(0);

const relative = path.relative(appDir, file);
const insideApp = !relative.startsWith("..") && !path.isAbsolute(relative);
// Dependencies not installed yet (fresh clone): nothing to run.
if (!insideApp || !existsSync(path.join(appDir, "node_modules")))
  process.exit(0);

const run = (args) =>
  spawnSync("npx", ["--no-install", ...args], {
    cwd: appDir,
    encoding: "utf8",
  });

const formattable = /\.(tsx?|jsx?|mjs|cjs|json|jsonc|css|html|md)$/;
if (formattable.test(file)) {
  run(["prettier", "--write", "--ignore-unknown", file]);
}

const typeRelevant = /\.(tsx?|mts|cts)$|(^|\/)tsconfig[^/]*\.json$/;
if (typeRelevant.test(relative)) {
  const result = run(["tsc", "-b", "--pretty", "false"]);
  if (result.status !== 0) {
    // Only the errors: the first line of each, and the indented lines that continue it.
    const lines = `${result.stdout}${result.stderr}`.split("\n");
    const errors = [];
    for (const line of lines) {
      if (/error TS\d+/.test(line)) errors.push(line);
      else if (/^\s+\S/.test(line) && errors.length > 0)
        errors[errors.length - 1] += `\n${line}`;
    }
    const shown = errors.slice(0, maxErrors).join("\n");
    const more =
      errors.length > maxErrors ? `\n+${errors.length - maxErrors} more` : "";
    console.error(
      shown ? `${shown}${more}` : lines.join("\n").trim().slice(0, 1000),
    );
    process.exit(2);
  }
}
