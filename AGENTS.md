# Capibara Calendar UI

This is a UI project for operating calendars.

It is a React app that talks to CalDAV-like backends.

## Layout and UI

We develop the layout mobile FIRST. The priorities that follow are fullscreen desktop, then responsiveness.

Use lucide icons.

Use shadcn components. (Use shadcn mcp)

In this UI, only the 24h time format is allowed.

Nowhere in the UI can the font size go under 14px. The one exception is the small count badges on the icons of the bottom bar.

The event create/edit and read-only screens must be kept as similar as possible and in sync.

For all forms or screens where the user can inadvertently lose changes, notify them with a non-native prompt. For example, when leaving an unsaved form screen.

View transitions are added only when the developer approves them (see the developer loop), because there are no tests for animations.

## Layout responsiveness

`LAYOUT-MATRIX.md` tracks the manual review of the layout: every row (a layout, a screen, a dialog) at every viewport, with realistic and with stress data. A cell is empty (not reviewed), ✅ (fine), ⚠️ (stale) or ❌ (has an issue).

When the developer asks what is not reviewed yet, answer from the table, without opening the browser.

To review rows with the developer:

1. Make sure the dev server runs on port 5173, and open one visible browser from `capibara-calendar-ui`: `npx playwright-cli open --headed "http://localhost:5173/?seed=realistic"`.
2. For each row, reach it as written in the Rows table of the matrix. Then `resize` the browser through the viewports P, L, H and D, and at each one wait for the developer to say whether it is fine. Then do the same with `?seed=stress`.
3. Write ✅ when it is fine and ❌ when it is not. The details of an issue stay in the chat, not in files.
4. Do not fix anything while reviewing: the fixes are a later iteration of the developer loop. Close the browser when the review ends.

A new layout, screen or important dialog gets a new row, with empty cells.

When the developer says how a cell must look (for example "on mobile each event takes the whole width"), write it as a layout test in `e2e/layout.spec.ts`, so that the reviewed layout survives later changes. Layout tests are light: they measure the boxes of elements (columns, widths, what is visible) and do not compare screenshots. They run on the seeded memory source, not against a CalDAV server, and they are not part of `test:e2e` nor of pre-push.

## Code conventions

Strictly follow the coding conventions in this file. If something is not specified, match the code style and patterns of the repo, and infer from dependencies and configuration.

Use es-toolkit.

Use the Temporal API.

When you are modifying files and you notice that a modified file does not respect the conventions written in AGENTS.md (because some conventions changed since the file was written), refactor it so that it does. This way we refactor code incrementally while making changes, instead of doing big refactors. If updating the code would trigger multiple changes across several files, ask the developer for confirmation first.

Do not create code files smaller than about 20 lines (configuration is an exception) unless strictly necessary. E.g. exceptions are files with exports used in several places that thematically do not belong in existing files.

Do not create files larger than about 300 lines unless strictly necessary. E.g. a file can exceed this threshold if splitting it would mean useless prop passing, if the length is mostly due to JSX, or if it would result in many exports with a single call site.

## Replication strategies

Each source replicates its data in its own way, and there is no shared sync layer on top of them.

- **webxdc:** the data lives in a Yjs document, and whatever Yjs reconciles is the result. Editing offline is possible, and the edits are merged when the peers meet again.
- **CalDAV:** the server is the source of truth, and events can only be edited online. There is no offline queue: a write made while offline fails, and the cached data stays readable. Writes are conditional on the etag, and a conflict (412) is shown to the user in the conflict dialog, which offers to overwrite or to reload.
- **Local (IndexedDB) and memory:** both live on a single device, so there is nothing to reconcile. The memory source is used by the tests.
- **Event identity:** an event is identified by its source, calendar and event id. Events are not reconciled across calendars or sources by their iCalendar UID while they are used, and this includes invitations, so the same event can appear twice.
- **Import and export (iCalendar files):** importing into a calendar is the only place where the UID is the identity. The event with the same UID in the destination calendar is the same event: the higher SEQUENCE is the newer, then the later LAST-MODIFIED or DTSTAMP, then the content that sorts last, so that every peer picks the same one. What is older or the same is left alone. Local and webxdc events keep `sequence`, `modified` and the `X-` properties, and an imported event gets its UID as its id, so two peers importing the same file converge on one event. For CalDAV the guests and the organizer are written with `SCHEDULE-AGENT=CLIENT`, so that the server sends no invitations. The filter applies to both import and export, and a series is in or out by its own fields. This is best effort between CalDAV and Yjs.

## Working with the developer

Work in the developer loop below.

DO NOT overuse tokens for activities that are not explicitly requested or not stated in the agent instructions.

### The developer loop

One feature per iteration. Each iteration goes through these steps, in this order:

1. **Plan in chat.** The plan is written in the chat, not in a file. Its items are numbered (1, 1.1, 1.2, 2, …), so that the developer can refer to them ("do 2.1, skip 3"). Questions that are not obvious come with the plan, numbered too. When the feature adds an interaction, the plan has an item that proposes the view transitions, for the developer to approve.
2. **Dependency order.** The items of the plan are in dependency order, in small steps that the developer can verify in the browser. The developer approves the plan, or the items of it, before anything is implemented.
3. **Implement.** Implement only the approved items, one step at a time. At the end of each step, run `npm run check:agent` and fix what it reports; when it reports missing Italian messages, write them in `src/locales/it/messages.po`. When the step changed code that a row of `LAYOUT-MATRIX.md` renders (the file of the row, or a component that it renders), mark the ✅ and ❌ cells of that row as ⚠️. Then end the step with what to check in the browser, and with the items that are still unanswered (open questions, choices that were not made). These are presented again after each step until the developer answers them: the agent does not decide them. No tests are written or run in this step, unless the developer asks: then run only the e2e specs of the feature, in one project (`npm run test:e2e:agent -- --project desktop <file>`; the Baikal specs need `--project baikal-desktop`).
4. **Finish.** The layout is reviewed and the tests are written in this last part of the iteration, in this order:
   1. Review with the developer the rows of `LAYOUT-MATRIX.md` that this iteration touched (the ⚠️ cells and the new rows), as in "Layout responsiveness". Do not propose the rows that the iteration did not touch. An issue found here is fixed and reviewed again, unless the developer postpones it: then its cell is ❌.
   2. Run all the unit tests, the full e2e suite and the layout tests once. For each test that broke: if the behavior changed on purpose, fix the test; if the app is wrong, fix the app; if it is not clear which, ask.
   3. Propose the tests to write (main happy paths and important error cases), as a numbered list. The developer says which of them to write, and only those are written.
   4. Run only the new tests, and keep fixing and running them until they pass.
   5. Then run `npm run check:agent`, all the unit tests, the full e2e suite and the layout tests once more.
5. **Commit.** The developer commits, never the agent. After the commit the developer compacts the conversation (`/compact`), or starts a new one, so that the next feature starts light. When the developer asks for a new feature, run `git status` first: if the changes of the previous feature are still not committed, remind the developer to commit and compact.

## Testing

E2E tests must run at least against a CalDAV server. They run against Radicale, and the specs about the CalDAV protocol also run against Baikal. Both servers are in `compose.yaml`, and Baikal starts from the seed in `baikal/`.

Change existing tests only if they break because of the change. New tests are only the ones the developer picked (see the developer loop).

UI tests should be written as if a user were interacting with the app: clicks and presses, observing what a human tester would observe. They should resemble e2e tests as much as possible.

Reserve unit tests for algorithms or permutations.

When you run tests, launch them without reading their progress, and read their result only when they finish. This way you save tokens if the tests did not break.

In each test, mark its three parts with the comments `// given` (the starting state), `// when` (what the user does) and `// then` (what the user sees).

A test file cannot be bigger than 500 lines.

New tests follow the rules of this section. When an existing test breaks because of a change and its file does not follow the latest rules of this section, restructure the file while fixing it, and split it into new files if needed. Do not restructure test files that did not break.

## Accessibility

Every screen must be accessible (when still).
Every interaction must be accessible.

## Local development

To run local development:
`docker compose up -d`
`cd capibara-calendar-ui && npm run dev`

To run webxdc: `cd capibara-calendar-ui && npm run dev` `npm run webxdc:simulate`

## Tools for AI agents

This section is an instruction for AI agents only. It saves tokens.

Run the unit tests with `npm run test:agent`, the e2e tests with `npm run test:e2e:agent` and the layout tests with `npm run test:layout:agent`, from `capibara-calendar-ui`. Never run `npm test`, `npx vitest` or `npx playwright test` directly. These scripts print only the totals and the failed tests. Put file filters after `--`.

To drive a browser, use the Playwright CLI from `capibara-calendar-ui` (`npx playwright-cli open <url>`, `snapshot`, `click`, `fill`, `close`). Its configuration is in `.playwright/cli.config.json`. Do not use a Playwright MCP.

To work with code by symbol (where a function or component is defined, who uses it, the outline of a file, replacing a whole symbol), prefer the Serena MCP tools. To search plain text, use the shell: `grep -n` for text, `find` and `ls` for files. Then read the place that was found by range with the Read tool.

Before using the API of a library, framework or tool, when its current documentation is not already in the context, pull it with the context7 MCP tools. This is not web search: it is always allowed. To read and edit files use the Read, Edit and Write tools, not `cat`, `head`, `tail`, `sed`, `awk`, shell redirects or scripts.
