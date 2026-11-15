import { msg } from '@lingui/core/macro'
import type { Answer, Field, GroupMode } from './event-filter'

/**
 * The words of the rules. Each rule is read as a sentence: its operator, then what it is about, so
 * that the screen needs no legend. The texts are whole phrases, and not pieces, because the order of
 * the words is not the same in every language.
 */
type Phrase = ReturnType<typeof msg>

export const fieldNames: Record<Field, Phrase> = {
  title: msg`Title`,
  location: msg`Location`,
  notes: msg`Notes`,
  tags: msg`Tags`,
  people: msg`People`,
  status: msg`Status`,
}

/** What a new rule of the field starts to say, shown in the menu that adds it. */
export const fieldHints: Record<Field, Phrase> = {
  title: msg`contains…`,
  location: msg`is at…`,
  notes: msg`mention…`,
  tags: msg`is tagged…`,
  people: msg`includes…`,
  status: msg`is…`,
}

export const operatorPhrases: Record<Field, Record<string, Phrase>> = {
  title: {
    contains: msg`title contains`,
    notContains: msg`title doesn't contain`,
    is: msg`title is`,
    isNot: msg`title isn't`,
    startsWith: msg`title starts with`,
    endsWith: msg`title ends with`,
    notEmpty: msg`has a title`,
    empty: msg`has no title`,
  },
  location: {
    is: msg`is at`,
    isNot: msg`isn't at`,
    contains: msg`location contains`,
    notContains: msg`location doesn't contain`,
    startsWith: msg`location starts with`,
    endsWith: msg`location ends with`,
    notEmpty: msg`has a location`,
    empty: msg`has no location`,
  },
  notes: {
    contains: msg`notes mention`,
    notContains: msg`notes don't mention`,
    is: msg`notes are exactly`,
    isNot: msg`notes aren't exactly`,
    startsWith: msg`notes start with`,
    endsWith: msg`notes end with`,
    notEmpty: msg`has notes`,
    empty: msg`has no notes`,
  },
  tags: {
    has: msg`is tagged`,
    hasNot: msg`isn't tagged`,
    anyOf: msg`is tagged with any of`,
    allOf: msg`is tagged with all of`,
    noneOf: msg`is tagged with none of`,
    notEmpty: msg`has tags`,
    empty: msg`has no tags`,
  },
  people: {
    has: msg`includes`,
    hasNot: msg`doesn't include`,
    anyOf: msg`includes any of`,
    allOf: msg`includes all of`,
    noneOf: msg`includes none of`,
    notEmpty: msg`has guests`,
    empty: msg`has no guests`,
  },
  status: {
    is: msg`is`,
    isNot: msg`isn't`,
    in: msg`is one of`,
    notIn: msg`is none of`,
  },
}

/** How a group combines its rules, said so that "Show events where" can come before it. */
export const groupPhrases: Record<GroupMode, Phrase> = {
  all: msg`all of these match`,
  any: msg`at least one of these matches`,
  none: msg`none of these match`,
  notAll: msg`at least one of these doesn't match`,
}

/** The answer of the people, said after their names. */
export const answerPhrases: Record<Answer, Phrase> = {
  '': msg`with any answer`,
  accepted: msg`who said yes`,
  tentative: msg`who said maybe`,
  declined: msg`who said no`,
  'needs-action': msg`who hasn't replied`,
}
