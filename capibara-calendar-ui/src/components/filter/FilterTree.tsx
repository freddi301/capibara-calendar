import { useAutoAnimate } from '@formkit/auto-animate/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { ChevronsUpDown, X } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  arityOf,
  groupModes,
  operatorsOf,
  removeNode,
  updateNode,
  withOperator,
  type Answer,
  type Group,
  type Rule,
} from '@/lib/event-filter'
import type { FilterSuggestions } from '@/lib/filter-suggestions'
import { answerPhrases, fieldNames, groupPhrases, operatorPhrases } from '@/lib/filter-phrases'
import AddRuleMenu from './AddRuleMenu'
import { FieldIcon } from './FieldIcon'
import { ItemsValue, StatusValue, TextValue } from './ValueEditors'

type Edit = (change: (root: Group) => Group) => void
type TreeProps = { edit: Edit; suggestions: FilterSuggestions }

const answers: Answer[] = ['', 'accepted', 'tentative', 'declined', 'needs-action']

// Each way of combining the rules has its own colour: the phrase is the button that changes it.
const tones: Record<Group['mode'], string> = {
  all: cn('bg-(--filter-all)/12 text-(--filter-all)'),
  any: cn('bg-(--filter-any)/12 text-(--filter-any)'),
  none: cn('bg-(--filter-none)/12 text-(--filter-none)'),
  notAll: cn('bg-(--filter-not-all)/12 text-(--filter-not-all)'),
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="ml-auto size-9 shrink-0 text-muted-foreground hover:text-destructive"
      aria-label={label}
      onClick={onClick}
    >
      <X className="size-4" aria-hidden="true" />
    </Button>
  )
}

function RuleRow({ rule, edit, suggestions }: TreeProps & { rule: Rule }) {
  const { t, i18n } = useLingui()
  const placesId = useId()
  const arity = arityOf(rule.field, rule.operator)
  const name = i18n._(fieldNames[rule.field])
  const change = (next: Partial<Rule>) => {
    edit((root) => updateNode<Rule>(root, rule.id, (found) => ({ ...found, ...next })))
  }
  const operators = Object.keys(operatorsOf[rule.field])
  const max = arity === 'one' ? 1 : undefined
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 py-0.5">
      <FieldIcon field={rule.field} className="size-5 shrink-0 text-muted-foreground" />
      <Select
        items={operators.map((operator) => ({
          value: operator,
          label: i18n._(operatorPhrases[rule.field][operator]),
        }))}
        value={rule.operator}
        onValueChange={(operator) => {
          if (!operator) return
          edit((root) => updateNode<Rule>(root, rule.id, (found) => withOperator(found, operator)))
        }}
      >
        <SelectTrigger
          className="h-8 w-auto border-transparent bg-transparent px-2 text-base font-medium hover:bg-muted dark:bg-transparent"
          aria-label={name}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="w-auto min-w-48">
          {operators.map((operator) => (
            <SelectItem key={operator} value={operator} className="min-h-11">
              {i18n._(operatorPhrases[rule.field][operator])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {arity === 'text' && (
        <>
          <TextValue
            value={rule.text}
            label={name}
            list={rule.field === 'location' ? placesId : undefined}
            onChange={(text) => {
              change({ text })
            }}
          />
          {rule.field === 'location' && (
            <datalist id={placesId}>
              {suggestions.places.map((place) => (
                <option key={place} value={place} />
              ))}
            </datalist>
          )}
        </>
      )}
      {(arity === 'one' || arity === 'many') && rule.field === 'status' && (
        <StatusValue
          items={rule.items}
          max={max}
          onChange={(items) => {
            change({ items })
          }}
        />
      )}
      {(arity === 'one' || arity === 'many') && rule.field !== 'status' && (
        <ItemsValue
          items={rule.items}
          max={max}
          label={name}
          isFree={rule.field === 'tags'}
          suggestions={rule.field === 'tags' ? suggestions.tags : suggestions.people}
          onChange={(items) => {
            change({ items })
          }}
        />
      )}
      {rule.field === 'people' && (arity === 'one' || arity === 'many') && (
        <Select
          items={answers.map((answer) => ({
            value: answer,
            label: i18n._(answerPhrases[answer]),
          }))}
          value={rule.answer}
          onValueChange={(answer) => {
            change({ answer: answer ?? '' })
          }}
        >
          <SelectTrigger
            className={cn(
              'h-8 w-auto border-transparent bg-transparent px-2 text-base hover:bg-muted dark:bg-transparent',
              rule.answer ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
            aria-label={t`Answer`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-48">
            {answers.map((answer) => (
              <SelectItem key={answer} value={answer} className="min-h-11">
                {i18n._(answerPhrases[answer])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <RemoveButton
        label={t`Remove the rule: ${name}`}
        onClick={() => {
          edit((root) => removeNode(root, rule.id))
        }}
      />
    </div>
  )
}

function GroupView({
  group,
  isRoot,
  edit,
  suggestions,
}: TreeProps & { group: Group; isRoot: boolean }) {
  const { t, i18n } = useLingui()
  const [bodyRef] = useAutoAnimate()
  const next = groupModes[(groupModes.indexOf(group.mode) + 1) % groupModes.length]
  return (
    <div className="flex flex-col">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={cn(
            'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            tones[group.mode],
          )}
          onClick={() => {
            edit((root) => updateNode<Group>(root, group.id, (found) => ({ ...found, mode: next })))
          }}
        >
          {i18n._(groupPhrases[group.mode])}
          <ChevronsUpDown className="size-4 opacity-60" aria-hidden="true" />
        </button>
        {!isRoot && (
          <RemoveButton
            label={t`Remove the group`}
            onClick={() => {
              edit((root) => removeNode(root, group.id))
            }}
          />
        )}
      </div>
      {/* The rules of the first level are not indented: only the ones in a group are. */}
      <div ref={bodyRef} className={cn('flex flex-col', !isRoot && 'ml-9')}>
        {group.children.map((child) =>
          child.kind === 'rule' ? (
            <RuleRow key={child.id} rule={child} edit={edit} suggestions={suggestions} />
          ) : (
            <GroupView
              key={child.id}
              group={child}
              isRoot={false}
              edit={edit}
              suggestions={suggestions}
            />
          ),
        )}
        {group.children.length === 0 && (
          <p className="flex min-h-9 items-center text-muted-foreground">
            {isRoot ? (
              <Trans>No rules yet: every event is shown.</Trans>
            ) : (
              <Trans>No rules in this group yet.</Trans>
            )}
          </p>
        )}
        <AddRuleMenu groupId={group.id} isRoot={isRoot} edit={edit} />
      </div>
    </div>
  )
}

/** The rules as a tree that is read as sentences, with nothing but the indentation to show the groups. */
export default function FilterTree({ root, ...props }: TreeProps & { root: Group }) {
  return <GroupView group={root} isRoot {...props} />
}
