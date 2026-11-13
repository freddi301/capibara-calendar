import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useLingui } from '@lingui/react/macro'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { nameInput } from '@/lib/input-attributes'
import { addTags, endsTag, joinTags, splitTags, takesTagAway } from '@/lib/tags'

type TagsInputProps = {
  value: string
  onChange: (value: string) => void
}

export default function TagsInput({ value, onChange }: TagsInputProps) {
  const { t } = useLingui()
  const [draft, setDraft] = useState('')
  const tags = splitTags(value)

  const [groupRef] = useAutoAnimate()
  const add = () => {
    if (!draft.trim()) return
    onChange(joinTags(addTags(tags, draft)))
    setDraft('')
  }
  const remove = (tag: string) => {
    onChange(joinTags(tags.filter((there) => there !== tag)))
  }

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={t`Tags`}
      className="flex w-full flex-wrap items-center gap-1.5"
    >
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="h-8 gap-1 rounded-lg pr-1 pl-2.5 text-base font-normal md:text-sm"
        >
          {tag}
          <button
            type="button"
            aria-label={t`Remove ${tag}`}
            className="flex size-6 items-center justify-center rounded-md text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
            onClick={() => {
              remove(tag)
            }}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <div className="relative min-w-36 flex-1">
        <Input
          value={draft}
          aria-label={t`New tag`}
          placeholder={t`New tag`}
          {...nameInput}
          className="pr-8"
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (endsTag(event.key)) {
              event.preventDefault() // not a new line, and not the comma in the text
              add()
            } else if (takesTagAway(event.key) && !draft && tags.length) {
              remove(tags[tags.length - 1])
            }
          }}
          onBlur={add}
        />
        <Button
          type="button"
          variant="ghost"
          aria-label={t`Add tag`}
          className="absolute top-1 right-1 size-6 rounded-md p-0 text-muted-foreground"
          onClick={add}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
