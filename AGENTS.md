# Capibar Calendar UI

This is a UI project for operating calendars.

It is a React app, that talks to a CalDav backend.

Optimize the ui for mobile screens and devices, on larger screens or wihtout touchscreen we make it work with the least amount of work.

Strictly follow coding conventions in this file. If not specified match code style and patterns from repo and infer based on dependencies and configuration.

e2e test must talk to the real caldav server.

Use lucide icons.

Use shadcn components.

Use Temporal api.

Write ui features in dependency order, small changes at atime i can verify in the browers then i will prompt you to implement next ones.

Ask questions if some implmentation choices are not obvious.

Time is 24h format in all the ui.

All forms or screen where user can inadvertenlty lose changes, notify him with a non native propmt. For example when leaving an unsaved form screen.

In this ui, only 24h format is allowed.

When you add new features or interactions, if it seems appropriate, prompt the developer to add view transitions, proposing how. The developer must approve, because there are no tests for animations.

To run local development:
`docker compose up -d`
`cd capibara-calendar-ui && npm run dev`
