export async function saveCalendarFile(name: string, text: string) {
  const chat = window.webxdc
  if (chat) {
    await chat.sendToChat({ file: { name, plainText: text } })
    return
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 10_000)
}

export type PickedFile = { name: string; text: string }

export async function pickCalendarFile(): Promise<PickedFile | undefined> {
  const chat = window.webxdc
  if (chat) {
    const files = await chat.importFiles({ extensions: ['.ics'], mimeTypes: ['text/calendar'] })
    const file = files.at(0)
    return file ? { name: file.name, text: await file.text() } : undefined
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ics,text/calendar'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(undefined)
        return
      }
      void file.text().then((text) => {
        resolve({ name: file.name, text })
      })
    })
    input.addEventListener('cancel', () => {
      resolve(undefined)
    })
    input.click()
  })
}
