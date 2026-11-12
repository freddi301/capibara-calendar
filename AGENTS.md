# Capibar Calendar UI

This is a UI project for operating calendars.

It is a React app, that talks to a CalDav backend.

We develop the layout mobile FIRST. The priorities that follow are fullscreen desktop, then resposnsiveness.

Strictly follow coding conventions in this file. If not specified match code style and patterns from repo and infer based on dependencies and configuration.

e2e test must run at least against a caldav server.

Use lucide icons.

Use shadcn components.

Use Temporal api.

Write ui features in dependency order, small changes at atime i can verify in the browers then i will prompt you to implement next ones.

Ask questions if some implmentation choices are not obvious.

Time is 24h format in all the ui.

All forms or screen where user can inadvertenlty lose changes, notify him with a non native propmt. For example when leaving an unsaved form screen.

In this ui, only 24h format is allowed.

When you add new features or interactions, if it seems appropriate, prompt the developer to add view transitions, proposing how. The developer must approve, because there are no tests for animations.

The event create/edit and readonly screens must be kept as similar as possbile and in sync.

Change tests only if they fail after we added or changed a feature.

DO NOT overuse tokens for activities not explicilty requested or not stated in in agent instructions.

Tests you can write unpromted are only main happy paths and important errors.

When it looks like the user is finishing up a feature or change or refactor, remind him that he instructs you what tests to write.

UI tests should be written as if user were interacting with the app.
Clicks and presses, and observe how a human testing the app would. Should resemble e2e tests as much as possible.

Reserve unit tests for algoruthms or permutations.

Nowhere in the UI font size can go under 14px.

To run local development:
`docker compose up -d`
`cd capibara-calendar-ui && npm run dev`
