import { Trans, useLingui } from '@lingui/react/macro'
import { Brackets, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { addNode, fields, groupToAdd, newRule, type Group } from '@/lib/event-filter'
import { fieldHints, fieldNames } from '@/lib/filter-phrases'
import { FieldIcon } from './FieldIcon'

type Edit = (change: (root: Group) => Group) => void

/** The button that adds a rule about a field, or a group of rules, at the end of a group. */
export default function AddRuleMenu({
  groupId,
  isRoot,
  edit,
}: {
  groupId: string
  isRoot: boolean
  edit: Edit
}) {
  const { i18n } = useLingui()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="my-1 inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-dashed border-input px-3 text-sm font-medium text-muted-foreground outline-none hover:border-solid hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <Plus className="size-4" aria-hidden="true" />
        <Trans>Add rule</Trans>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56">
        {fields.map((field) => (
          <DropdownMenuItem
            key={field}
            className="min-h-11 gap-3"
            onClick={() => {
              edit((root) => addNode(root, groupId, newRule(field)))
            }}
          >
            <FieldIcon field={field} />
            {i18n._(fieldNames[field])}
            <span className="ml-auto text-muted-foreground">{i18n._(fieldHints[field])}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11 gap-3"
          onClick={() => {
            edit((root) => addNode(root, groupId, groupToAdd(isRoot)))
          }}
        >
          <Brackets className="size-4" aria-hidden="true" />
          <Trans>Group of rules</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
