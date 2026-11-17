# Capibara Calendar UI

The UI of Capibara Calendar: a React frontend for CalDAV calendars, also packed as the webxdc app _Calendario_. The overview of the variants is in the [README of the repository](../README.md).

The development is intended to be done in VSCode with Claude Code, following [AGENTS.md](../AGENTS.md).

## Scripts

- `npm run dev`: the dev server (port 5173).
- `npm run build`: the web app, in `dist`.
- `npm run webxdc:pack`: the webxdc app, `calendario.xdc`.
- `npm run webxdc:simulate`: the webxdc simulator, on the dev server.
- `npm run publish:webxdc -- <version>`: tags and publishes a release with `calendario.xdc` attached.
- `npm run check:agent`: types, lint, knip, format and the Italian catalog.

## License

AGPL-3.0-only, see [LICENSE](../LICENSE).
