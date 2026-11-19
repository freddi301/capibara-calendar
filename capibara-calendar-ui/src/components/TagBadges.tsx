import { cn } from 'cn'

export default function TagBadges({ tags, className }: { tags: string[]; className?: string }) {
  return (
    <span
      className={cn('-mx-1 flex min-w-0 gap-x-2.5 overflow-clip px-1 whitespace-nowrap', className)}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="relative isolate shrink-0 before:absolute before:-inset-x-1 before:inset-y-0 before:-z-10 before:rounded-sm before:border before:border-border before:bg-secondary"
        >
          {tag}
        </span>
      ))}
    </span>
  )
}
