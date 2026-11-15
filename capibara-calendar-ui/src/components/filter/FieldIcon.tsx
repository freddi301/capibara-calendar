import { AlignLeft, CircleCheck, MapPin, Tag, Type, Users, type LucideIcon } from 'lucide-react'
import type { Field } from '@/lib/event-filter'

const icons: Record<Field, LucideIcon> = {
  title: Type,
  location: MapPin,
  notes: AlignLeft,
  tags: Tag,
  people: Users,
  status: CircleCheck,
}

/** The icon of a field of the events, as the one of its rules. It says nothing that the words do not. */
export function FieldIcon({ field, className }: { field: Field; className?: string }) {
  const Icon = icons[field]
  return <Icon className={className ?? 'size-4 shrink-0'} aria-hidden="true" />
}
