import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useLingui } from '@lingui/react/macro'
import { GripVertical, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { nameInput } from '@/lib/input-attributes'
import {
  addTags,
  endsTag,
  joinTags,
  moveTag,
  splitTags,
  tagBadgeMark,
  tagBadgeSelector,
  takesTagAway,
} from '@/lib/tags'

type TagsInputProps = {
  value: string
  onChange: (value: string) => void
}

function SortableTag({
  tag,
  isMovable,
  onRemove,
}: {
  tag: string
  isMovable: boolean
  onRemove: () => void
}) {
  const { t } = useLingui()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag })
  return (
    <Badge
      ref={setNodeRef}
      {...tagBadgeMark}
      variant="secondary"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative h-8 gap-1 rounded-lg pr-1 text-base font-normal md:text-sm',
        isMovable ? 'pl-1' : 'pl-2.5',
        isDragging && 'z-10 shadow-md',
      )}
    >
      {isMovable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t`Move ${tag}`}
          className="flex size-6 touch-none items-center justify-center rounded-md text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
        >
          <GripVertical className="size-3" />
        </button>
      )}
      {tag}
      <button
        type="button"
        aria-label={t`Remove ${tag}`}
        className="flex size-6 items-center justify-center rounded-md text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
        onClick={onRemove}
      >
        <X className="size-3" />
      </button>
    </Badge>
  )
}

export default function TagsInput({ value, onChange }: TagsInputProps) {
  const { t } = useLingui()
  const [draft, setDraft] = useState('')
  const tags = splitTags(value)

  const [groupRef] = useAutoAnimate()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const drop = ({ active, over, activatorEvent }: DragEndEvent) => {
    if (over) {
      onChange(
        joinTags(moveTag(tags, tags.indexOf(String(active.id)), tags.indexOf(String(over.id)))),
      )
    }
    const badge =
      activatorEvent.target instanceof Element
        ? activatorEvent.target.closest(tagBadgeSelector)
        : null
    requestAnimationFrame(() => {
      for (const animation of badge?.getAnimations() ?? []) {
        if (!(animation instanceof CSSTransition)) animation.cancel()
      }
    })
  }
  const add = () => {
    if (!draft.trim()) return
    onChange(joinTags(addTags(tags, draft)))
    setDraft('')
  }
  const remove = (tag: string) => {
    onChange(joinTags(tags.filter((there) => there !== tag)))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => {
            const tag = String(active.id)
            return t`${tag} picked up`
          },
          onDragOver: ({ active, over }) => {
            if (!over) return undefined
            const tag = String(active.id)
            const place = tags.indexOf(String(over.id)) + 1
            return t`${tag} is at position ${place}`
          },
          onDragEnd: ({ active, over }) => {
            const tag = String(active.id)
            const place = over ? tags.indexOf(String(over.id)) + 1 : tags.indexOf(tag) + 1
            return t`${tag} dropped at position ${place}`
          },
          onDragCancel: ({ active }) => {
            const tag = String(active.id)
            return t`Moving ${tag} was cancelled`
          },
        },
        screenReaderInstructions: {
          draggable: t`To move this tag, press Space to pick it up, the arrow keys to choose the place, and Space to drop it. Escape cancels.`,
        },
        restoreFocus: true,
      }}
      onDragEnd={drop}
    >
      <SortableContext items={tags} strategy={rectSortingStrategy}>
        <div
          ref={groupRef}
          role="group"
          aria-label={t`Tags`}
          className="flex w-full flex-wrap items-center gap-1.5"
        >
          {tags.map((tag) => (
            <SortableTag
              key={tag}
              tag={tag}
              isMovable={tags.length > 1}
              onRemove={() => {
                remove(tag)
              }}
            />
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
      </SortableContext>
    </DndContext>
  )
}
