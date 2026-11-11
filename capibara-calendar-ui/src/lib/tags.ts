export const splitTags = (tags: string) =>
  tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

export function addTags(tags: string[], said: string) {
  const next = [...tags]
  for (const tag of splitTags(said)) {
    if (!next.some((there) => there.toLowerCase() === tag.toLowerCase())) next.push(tag)
  }
  return next
}

export const joinTags = (tags: string[]) => tags.join(', ')

export const endsTag = (key: string) => key === 'Enter' || key === ','
export const takesTagAway = (key: string) => key === 'Backspace'
