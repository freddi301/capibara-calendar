import { monthColumns, openStress, testColumns } from '../support/columns.ts'

// The layouts that the developer approved in LAYOUT-MATRIX.md, so that they survive changes. The
// month is shown from 1024×640: of the viewports of the matrix, only the full desktop.

testColumns('month', { desktop: 1 }, (page) => openStress(page, 'month'), monthColumns)
