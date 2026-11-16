import { useDndContext } from '@dnd-kit/core'
import { useEffect, useRef } from 'react'
import { useEdgePaging } from '@/lib/use-edge-paging'

type EdgePagingProps = {
  weekKey: string
  onPage: (direction: 1 | -1) => void
}

export default function EdgePaging({ weekKey, onPage }: EdgePagingProps) {
  const dnd = useDndContext()
  const isDragging = dnd.active !== null
  useEdgePaging(isDragging, onPage)

  const context = useRef(dnd)
  useEffect(() => {
    context.current = dnd
  })
  useEffect(() => {
    if (!isDragging) return
    const frame = requestAnimationFrame(() => {
      const current = context.current
      current.measureDroppableContainers(
        current.droppableContainers.getEnabled().map(({ id }) => id),
      )
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [isDragging, weekKey])

  return null
}
