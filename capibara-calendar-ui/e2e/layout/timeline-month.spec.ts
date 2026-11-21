import { openStress, testColumns, timelineColumns } from '../support/columns.ts'

// The layouts that the developer approved in LAYOUT-MATRIX.md, so that they survive changes.

testColumns(
  'timeline month',
  { portrait: 2, landscape: 3, half: 4, desktop: 6 },
  (page) => openStress(page, 'timelineMonth'),
  timelineColumns,
)
