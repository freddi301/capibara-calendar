const storageKey = 'capibara-calendar'

/** Keeps the text as it is, to test what is wrong in it. */
export const seedText = (text: string) => {
  localStorage.setItem(storageKey, text)
}

/** What the browser had kept before the test: the parts that are given, over what was there. */
export const seedStored = (stored: object) => {
  seedText(JSON.stringify({ ...storedJson(), ...stored }))
}

/** What the app kept, as it is. */
export const storedJson = () =>
  JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, unknown>
