# Capibara Calendar UI

This is a UI project for operating calendars.

It is a React app that talks to CalDAV-like backends.

## Layout and UI

We develop the layout mobile FIRST. The priorities that follow are fullscreen desktop, then responsiveness.

Use lucide icons.

Use shadcn components. (Use shadcn mcp)

In this UI, only the 24h time format is allowed.

Nowhere in the UI can the font size go under 14px.

The event create/edit and read-only screens must be kept as similar as possible and in sync.

For all forms or screens where the user can inadvertently lose changes, notify them with a non-native prompt. For example, when leaving an unsaved form screen.

When you add new features or interactions, if it seems appropriate, prompt the developer to add view transitions, proposing how. The developer must approve, because there are no tests for animations.

## Code conventions

Strictly follow the coding conventions in this file. If something is not specified, match the code style and patterns of the repo, and infer from dependencies and configuration.

Use es-toolkit.

Use the Temporal API.

When you are modifying files and you notice that a modified file does not respect the conventions written in AGENTS.md (because some conventions changed since the file was written), refactor it so that it does. This way we refactor code incrementally while making changes, instead of doing big refactors. If updating the code would trigger multiple changes across several files, ask the developer for confirmation first.

Do not create code files smaller than about 20 lines (configuration is an exception) unless strictly necessary. E.g. exceptions are files with exports used in several places that thematically do not belong in existing files.

Do not create files larger than about 300 lines unless strictly necessary. E.g. a file can exceed this threshold if splitting it would mean useless prop passing, if the length is mostly due to JSX, or if it would result in many exports with a single call site.

## Working with the developer

Write UI features in dependency order, in small changes at a time that the developer can verify in the browser; the developer will then prompt you to implement the next ones.

Ask questions if some implementation choices are not obvious.

DO NOT overuse tokens for activities that are not explicitly requested or not stated in the agent instructions.

When it looks like the user is finishing up a feature, change or refactor, remind them that they instruct you on what tests to write.

## Testing

E2E tests must run at least against a CalDAV server.

Change tests only if they fail after we added or changed a feature.

The only tests you can write unprompted are main happy paths and important error cases.

UI tests should be written as if a user were interacting with the app: clicks and presses, observing what a human tester would observe. They should resemble e2e tests as much as possible.

Reserve unit tests for algorithms or permutations.

When you run tests, launch them without reading their progress, and read their result only when they finish. This way you save tokens if the tests did not break.

## Local development

To run local development:
`docker compose up -d`
`cd capibara-calendar-ui && npm run dev`

To run webxdc: `cd capibara-calendar-ui && npm run dev` `npm run webxdc:simulate`

## Tools for AI agents

This section is an instruction for AI agents only. It saves tokens.

Run the unit tests with `npm run test:agent` and the e2e tests with `npm run test:e2e:agent`, from `capibara-calendar-ui`. Never run `npm test`, `npx vitest` or `npx playwright test` directly. These scripts print only the totals and the failed tests. Put file filters after `--`.

To drive a browser, use the Playwright CLI from `capibara-calendar-ui` (`npx playwright-cli open <url>`, `snapshot`, `click`, `fill`, `close`). Its configuration is in `.playwright/cli.config.json`. Do not use a Playwright MCP.

To find the usages of a symbol or to rename it across files, use the Serena tools. For reading, searching and editing files, use the Read, Grep, Glob, Edit and Write tools instead of shell commands such as cat, grep, sed or find: a hook blocks those.
