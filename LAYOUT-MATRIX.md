# Layout matrix

Manual review of layout and responsiveness: every screen and important dialog, at every viewport, with realistic and with stress data. The workflow is in AGENTS.md, section "Layout responsiveness".

## Viewports and data

| Code | Viewport         | Size      |
| ---- | ---------------- | --------- |
| P    | Mobile portrait  | 412×915   |
| L    | Mobile landscape | 915×412   |
| H    | Half desktop     | 960×1000  |
| D    | Full desktop     | 1920×1080 |

| Code | Data      | URL                | Language and theme |
| ---- | --------- | ------------------ | ------------------ |
| R    | Realistic | `/?seed=realistic` | English, light     |
| S    | Stress    | `/?seed=stress`    | Italian, dark      |

## Marks

| Mark | Meaning                                       |
| ---- | --------------------------------------------- |
|      | Not reviewed yet                              |
| ✅   | Reviewed, fine                                |
| ⚠️   | Stale: it was reviewed, then its code changed |
| ❌   | Has an issue                                  |

## Matrix

| Row                        | P·R | P·S | L·R | L·S | H·R | H·S | D·R | D·S |
| -------------------------- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agenda                     | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Agenda, week strip         |     |     |     |     |     |     |     |     |
| Agenda, month table        |     |     |     |     |     |     |     |     |
| Week rows                  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Timeline day               | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Timeline week              | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Timeline month             | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Empty states               | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Event detail               | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Event form (create, edit)  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Calendars                  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Calendar edit              | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| View (what to see)         | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Layout switcher            | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Filters                    | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Import                     | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Export                     | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Settings                   | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Event menu (quick actions) | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Edit scope dialog          | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Discard changes dialog     | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Contact picker dialog      | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| Conflict dialog            | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |

## Rows

Each row with the file it starts from (in `capibara-calendar-ui/src`) and how to reach it. A row covers its file and everything that file renders: a change to a shared component makes stale every row that renders it.

| Row                        | File                                  | How to reach                                                                  |
| -------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| Agenda                     | `screens/AgendaScreen.tsx`            | Layout switcher → Agenda                                                      |
| Agenda, week strip         | `components/DayPickerBar.tsx`         | Agenda → the week strip under the date line                                   |
| Agenda, month table        | `components/DayPickerBar.tsx`         | Agenda → the chevron under the week strip                                     |
| Week rows                  | `screens/WeekRowsScreen.tsx`          | Layout switcher → Week                                                        |
| Timeline day               | `screens/TimelineScreen.tsx`          | Layout switcher → Timeline day                                                |
| Timeline week              | `screens/TimelineScreen.tsx`          | Layout switcher → Timeline week                                               |
| Timeline month             | `screens/TimelineScreen.tsx`          | Layout switcher → Timeline month                                              |
| Empty states               | `components/EmptyState.tsx`           | Add `&empty` to the seed URL, then Agenda; also a filter that matches nothing |
| Event detail               | `screens/EventDetailScreen.tsx`       | Click an event (stress: the red one tomorrow 09:00)                           |
| Event form (create, edit)  | `screens/CreateEditEventScreen.tsx`   | The + button; or event detail → edit                                          |
| Calendars                  | `screens/CalendarsScreen.tsx`         | The calendars button (with the count badge)                                   |
| Calendar edit              | `screens/CalendarEditScreen.tsx`      | Calendars → a calendar                                                        |
| View (what to see)         | `screens/ViewScreen.tsx`              | The eye button                                                                |
| Layout switcher            | `screens/LayoutSwitcherScreen.tsx`    | The grid button                                                               |
| Filters                    | `screens/FiltersScreen.tsx`           | The filter button                                                             |
| Import                     | `screens/ImportScreen.tsx`            | Calendars → import                                                            |
| Export                     | `screens/ExportScreen.tsx`            | Calendars → export                                                            |
| Settings                   | `screens/SettingsScreen.tsx`          | The gear button                                                               |
| Event menu (quick actions) | `components/EventMenu.tsx`            | Right-click or long-press an event in a list                                  |
| Edit scope dialog          | `components/EditScopeDialog.tsx`      | Edit or delete an occurrence of a series                                      |
| Discard changes dialog     | `components/DiscardChangesDialog.tsx` | Change the event form, then go back                                           |
| Contact picker dialog      | `components/ContactPickerDialog.tsx`  | Event form → add participants                                                 |
| Conflict dialog            | `components/ConflictDialog.tsx`       | CalDAV only: edit the same event in two tabs, save both                       |
