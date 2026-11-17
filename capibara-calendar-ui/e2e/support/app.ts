import { expect, type Page } from '@playwright/test'

export async function reload(page: Page) {
  await page.reload()
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
}

export const unique = (project: string, name: string) => `${name} ${project} ${Date.now()}`
export const uid = (title: string) => title.replaceAll(' ', '-')

export async function open(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
}

export async function chooseLayout(page: Page, name: string) {
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name, exact: true }).click()
}

export async function showMonth(page: Page) {
  await page.getByRole('button', { name: 'Show the month' }).click()
}

export async function drag(page: Page, from: [number, number], to: [number, number]) {
  await page.mouse.move(...from)
  await page.mouse.down()
  await page.mouse.move(...to, { steps: 6 })
  await page.mouse.up()
}

export const center = async (page: Page, name: string) => {
  const box = await page.getByRole('group', { name, exact: true }).boundingBox()
  if (!box) throw new Error(`No ${name}`)
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    width: box.width,
    height: box.height,
  }
}
