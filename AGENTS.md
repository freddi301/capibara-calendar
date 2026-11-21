# Capibara Calendar UI

This is a UI project for operating calendars.

It is a React app that talks to CalDAV-like backends.

It implements the calendar features and part of the contacts. It does NOT implement journals or todos.

To keep this file in shape, these must always hold:

- No redundancy or repetition in the text.
- No incoherent or incongruent instructions.
- Nothing that is already expressed in code or configuration.
- Only Opus 5.5 with high effort or higher alters this file.

Warn the developer when any of these does not hold.

To maintain this file, the developer regularly gives an agent this prompt:

> Read AGENTS.md in full. List every duplication, repetition or redundancy, every inconsistency or incongruence, every ambiguity, and everything already expressed in code or configuration. Number the items F1, F2… and do not edit the file.

## Layout and UI

We develop the layout mobile FIRST. The priorities that follow are fullscreen desktop, then responsiveness.

Use lucide icons.

Use shadcn components.

In this UI, only the 24h time format is allowed.

Nowhere in the UI can the font size go under 14px. The one exception is the small count badges on the icons of the bottom bar.

The event create/edit and read-only screens must be kept as similar as possible and in sync.

For all forms or screens where the user can inadvertently lose changes, notify them with a non-native prompt. For example, when leaving an unsaved form screen.

View transitions are added only when the developer approves them (see the developer loop), because there are no tests for animations.

## Layout responsiveness

`capibara-calendar-ui/LAYOUT-MATRIX.md` tracks the manual review of the layout: every row (a layout, a screen, a dialog) at every viewport, with realistic and with stress data. A cell is empty (not reviewed), ✅ (fine), ⚠️ (stale) or ❌ (has an issue).

When the developer asks what is not reviewed yet, answer from the table, without opening the browser.

To review rows with the developer:

1. Make sure the dev server runs on port 5173, and open one visible browser from `capibara-calendar-ui`: `npx playwright-cli open --headed "http://localhost:5173/?seed=realistic"`.
2. For each row, reach it as written in the Rows table of the matrix. Then `resize` the browser through the viewports P, L, H and D, and at each one wait for the developer to say whether it is fine. Then do the same with `?seed=stress`.
3. Write ✅ when it is fine and ❌ when it is not. The details of an issue stay in the chat, not in files.
4. Do not fix anything while reviewing: the issues are fixed after the review, as in L5.1. Close the browser when the review ends.

A new layout, screen or important dialog gets a new row, with empty cells.

When the developer says how a cell must look (for example "on mobile each event takes the whole width"), write it as a layout test (see "Test kinds"), so that the reviewed layout survives later changes. Layout tests are light: they measure the boxes of elements (columns, widths, what is visible) and do not compare screenshots.

## Code conventions

Strictly follow the coding conventions in this file. If something is not specified, match the code style and patterns of the repo, and infer from dependencies and configuration.

Use es-toolkit.

Use the Temporal API.

When you are modifying files and you notice that a modified file does not respect the conventions of this file (because some conventions changed since the file was written), refactor it so that it does. This way we refactor code incrementally while making changes, instead of doing big refactors. If updating the code would trigger multiple changes across several files, ask the developer for confirmation first.

Do not create source files smaller than about 20 lines (configuration is an exception) unless strictly necessary. E.g. exceptions are files with exports used in several places that thematically do not belong in existing files.

Do not create source files larger than about 300 lines unless strictly necessary. E.g. a file can exceed this threshold if splitting it would mean useless prop passing, if the length is mostly due to JSX, or if it would result in many exports with a single call site.

## Replication strategies

Each source replicates its data in its own way, and there is no shared sync layer on top of them.

- **webxdc:** the data lives in a Yjs document, and whatever Yjs reconciles is the result. Editing offline is possible, and the edits are merged when the peers meet again.
- **CalDAV:** the server is the source of truth, and events can only be edited online. There is no offline queue: a write made while offline fails, and the cached data stays readable. Writes are conditional on the etag, and a conflict (412) is shown to the user in the conflict dialog, which offers to overwrite or to reload.
- **Webcal (subscriptions):** a feed is a read-only calendar, one per address, and the feed is the source of truth: it is downloaded whole and read again, never merged, and a write fails. It is asked for again at the interval that the feed says (`REFRESH-INTERVAL` or `X-PUBLISHED-TTL`, 5 minutes at least), or every 15 minutes. It is downloaded from the browser, and through the proxy when the browser is not let to (CORS). Only through the proxy is it asked with `If-None-Match` and `If-Modified-Since`, so that an unchanged file is not downloaded again. It is not available in webxdc.
- **Local (IndexedDB) and memory:** both live on a single device, so there is nothing to reconcile.
- **Event identity:** an event is identified by its source, calendar and event id. Events are not reconciled across calendars or sources by their iCalendar UID while they are used, and this includes invitations, so the same event can appear twice.
- **Import and export (iCalendar files):** importing into a calendar is the only place where the UID is the identity. The event with the same UID in the destination calendar is the same event: the higher SEQUENCE is the newer, then the later LAST-MODIFIED or DTSTAMP, then the content that sorts last, so that every peer picks the same one. What is older or the same is left alone. Local and webxdc events keep `sequence`, `modified` and the `X-` properties, and an imported event gets its UID as its id, so two peers importing the same file converge on one event. For CalDAV the guests and the organizer are written with `SCHEDULE-AGENT=CLIENT`, so that the server sends no invitations. The filter applies to both import and export, and a series is in or out by its own fields. This is best effort between CalDAV and Yjs.

## Working with the developer

Work in the developer loop below.

DO NOT overuse tokens for activities that are not explicitly requested or not stated in the agent instructions.

The LLM agents MUST NOT read DEVELOPER-ROADMAP.md!!!

### The developer loop

One feature per iteration. An iteration starts from a wish of the developer (add or change a feature), and goes through these steps, in this order.

Every message of the agent to the developer starts with one short line saying the step of the loop it is in, by number and name, for example `Loop: L4 Implement (P2.1)` or `Loop: L5.2 Test proposal`. A side question keeps the step that it interrupts, with its topic in brackets (`Loop: L4 Implement (side question: …)`), and without an iteration the line is `Loop: none`.

Everything the agent lists in the chat is numbered with a prefix, so that the developer can refer to it ("do P2.1, skip P3"). Sub-items take a dot (P1, P1.1, P1.2, P2):

- **L**: the steps of the developer loop.
- **U**: what the agent understood of the wish.
- **AI**: the as-is. **TB**: the to-be. The two are numbered independently.
- **P**: the items of the plan.
- **LR**: the issues found in a layout review.
- **T**: the tests proposed.
- **Q** after a prefix: the questions about that list (UQ1, TBQ2, PQ1, TQ1).

The steps:

- **L1 Understanding.** First run `git status`: if the changes of the previous feature are still not committed, remind the developer to commit and compact. Then the agent writes what it understood of the wish (U), with its questions (UQ). The developer confirms or corrects it.
- **L2 As-is / to-be.** The agent lists how the app behaves now (AI) and how it will behave (TB), with its questions (AIQ, TBQ). The developer agrees or corrects them. L1 and L2 are not skipped for small or obvious wishes. They are skipped only for the prompts that refine or correct something in the middle of the loop.
- **L3 Plan.** The plan is written in the chat, not in a file. Its items (P) are in dependency order, in small steps that the developer can verify in the browser. Questions that are not obvious come with the plan (PQ). When the feature adds an interaction, the plan has an item that proposes the view transitions. The developer approves the plan, or the items of it, before anything is implemented.
- **L4 Implement.** Implement only the approved items, one step at a time. At the end of each step, run `npm run check:agent` and fix what it reports. When the step changed code that a row of `LAYOUT-MATRIX.md` renders (the file of the row, or a component that it renders), mark the ✅ and ❌ cells of that row as ⚠️. Then end the step with what to check in the browser, and with the items that are still unanswered (open questions, choices that were not made). These are presented again after each step until the developer answers them: the agent does not decide them. No tests are written or run in this step, unless the developer asks: then only the ones that the developer asks for.
- **L5 Finish.** The layout is reviewed and the tests are written in this last part of the iteration, in this order:
  - **L5.1 Layout review.** Review with the developer the rows of `LAYOUT-MATRIX.md` that this iteration touched (the ⚠️ cells and the new rows), as in "Layout responsiveness". Do not propose the rows that the iteration did not touch. An issue found here (LR) is fixed and reviewed again, unless the developer postpones it: then its cell is ❌.
  - **L5.2 Test proposal.** Propose the tests to write (T: main happy paths, important error cases, and the interactions that took several rounds in the chat), each with the folder it goes in (see "Test kinds"). The developer says which of them to write, and only those are written.
  - **L5.3 Full run.** Run `npm run check:agent`, the Vitest tests, the e2e tests, the layout tests and the a11y tests once. If everything passes, the iteration is finished.
  - **L5.4 Fix.** Otherwise, fix each test that broke, new or old: if the behavior changed on purpose, fix the test; if the app is wrong, fix the app; if it is not clear which, ask. Run only the broken tests again, and keep fixing and running them until they pass. Then run `npm run check:agent`, the Vitest tests, the e2e tests, the layout tests and the a11y tests one last time.
- **L6 Commit.** The developer commits, never the agent. After the commit the developer compacts the conversation (`/compact`), or starts a new one, so that the next feature starts light.

## Testing

### Test kinds

Each kind of test has its own configuration. The rest of this file refers to the kinds by these names.

- **Vitest tests**: the unit tests and the ui tests, run together with `npm run test:agent`.
  - **Unit tests** (`src/test/unit/<module>.test.ts`, one file per module): algorithms and permutations. They import functions and render nothing. They run without a DOM, unless they use browser APIs (`localStorage`, `DOMParser`…): then the file starts with `// @vitest-environment jsdom`.
  - **UI tests**: they run in jsdom, render the app through the render helper and act like a user: clicks and presses, observing what a human tester would observe, as close to the e2e tests as possible.
    - `src/test/ui/screens/<Screen>/<feature>.test.tsx`: one folder per screen, and one file per feature of that screen, with its interactions and edge cases (for example `ui/screens/EventDetail/participants.test.tsx`).
    - `src/test/ui/stories/<journey>.test.tsx`: a journey across screens, for the main happy paths of a feature that do not involve the server.
- **E2E tests** (`e2e/stories/<journey>.spec.ts`): Playwright against the CalDAV servers of the tests (see "Local development"): Radicale, and Baikal for the specs of the CalDAV protocol (a new protocol spec is added to `protocolSpecs` in `playwright.config.ts`). Only stories: the journeys that involve the server and the cases of the CalDAV protocol. The edge cases of a screen are ui tests. Run with `npm run test:e2e:agent`, which runs on Radicale only and leaves out the tests tagged `@matrix`: a test that only repeats a journey for more devices or servers gets that tag. The whole matrix, with Baikal, runs before each push, in the pre-push hook.
- **Layout tests** (`e2e/layout/<row>.spec.ts`, one file per row of `LAYOUT-MATRIX.md`): Playwright on the seeded memory source, not against a CalDAV server (see "Layout responsiveness"), run with `npm run test:layout:agent`.
- **A11y tests** (`e2e/a11y/<area>.spec.ts`): Playwright with axe on the seeded memory source, not against a CalDAV server, run with `npm run test:a11y:agent`.

Helpers shared by tests go in a `support/` folder (`src/test/support/`, `e2e/support/`).

The tests never use the dev server of the developer (port 5173).

### Writing tests

In each test, mark its parts with the comments `// given` (the starting state), `// when` (what the user does) and `// then` (what the user sees), in this order. `// when` and `// then` can repeat, for the steps of one journey.

A test file cannot be bigger than 500 lines.

New tests follow "Test kinds" and the rules of this section. An existing test file is changed only when the iteration breaks it or has to change it. Then it is aligned with this file as in "Code conventions", but it is split into new files when needed without asking first. Test files that the iteration neither broke nor had to change are left as they are.

### Running tests

Run the tests with the scripts in "Test kinds", from `capibara-calendar-ui`, and put file filters after `--`. Never run `npm test`, `npx vitest` or `npx playwright test` directly.

Launch the tests without reading their progress, and read their result only when they finish. This way you save tokens if the tests did not break.

When a full run takes longer than its limit (the duration that its script prints), tell the developer that those tests have become slow and need to be made faster: the Vitest tests 30 seconds, the e2e tests 90 seconds, the layout tests 10 seconds, the a11y tests 30 seconds.

## Accessibility

Every screen must be accessible (when still).
Every interaction must be accessible.

## Local development

To run local development:
`cd capibara-calendar-ui`
`docker compose up -d`
`npm run dev`

In `capibara-calendar-ui/compose.yaml`, `radicale` is for hand tests and development, and the `seed-*.mjs` scripts of `capibara-calendar-ui/scripts/` target it. The services of the `e2e` profile are for the e2e tests.

To run webxdc, from `capibara-calendar-ui`: `npm run dev`, then `npm run webxdc:simulate`.

## Variants and releases

The repository holds several variants of the app, all built from the UI in `capibara-calendar-ui`: the webxdc app (_Calendario_, `calendario.xdc`), the web app and, later, a self-hosted server that serves the web app. The license of all of them is AGPL-3.0-only (`LICENSE`).

There is one version for all the variants (the one in `capibara-calendar-ui/package.json`) and one tag per release, `vX.Y.Z`. Each variant attaches its own file to the release. A variant that changes alone still gets a version bump.

The webxdc app is released by the developer with `npm run publish:webxdc -- <version>` (from `capibara-calendar-ui`), and the agent never runs it. The store entry (`[app:calendario]` in `xdcget.ini`) is submitted by the developer, as a PR to the xdcget repository on Codeberg.

- The `.xdc` must stay lean.
- In the webxdc app the chat is the only source of events. It is always on and has no switch.
- The font is the Latin subset of Inter only (enough for English and Italian): a new language that needs other scripts needs its subset added in `src/index.css`.
- Nothing in the webxdc app may use the network (the messenger denies it), `document.cookie`, `unload`/`beforeunload` or `alert`/`confirm`/`prompt`.

## Tools for AI agents

This section is an instruction for AI agents only. It saves tokens.

To drive a browser, use the Playwright CLI from `capibara-calendar-ui` (`npx playwright-cli open <url>`, `snapshot`, `click`, `fill`, `close`). Its configuration is in `.playwright/cli.config.json`. Do not use a Playwright MCP.

To work with code by symbol (where a function or component is defined, who uses it, the outline of a file, replacing a whole symbol), prefer the Serena MCP tools. To search plain text, use the shell: `grep -n` for text, `find` and `ls` for files. Then read the place that was found by range with the Read tool.

Before using the API of a library, framework or tool, when its current documentation is not already in the context, pull it with the context7 MCP tools. This is not web search: it is always allowed. To find and add shadcn components, use the shadcn MCP tools. To read and edit files use the Read, Edit and Write tools, not `cat`, `head`, `tail`, `sed`, `awk`, shell redirects or scripts.
