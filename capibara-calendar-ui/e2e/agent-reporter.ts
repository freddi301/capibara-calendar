import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import type { FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter'

const errorLines = 6

/** For agents: the totals, and for each failed test its place and the start of its error. */
export default class AgentReporter implements Reporter {
  private suite?: Suite

  onBegin(_config: unknown, suite: Suite) {
    this.suite = suite
  }

  onEnd(result: FullResult) {
    const tests = this.suite?.allTests() ?? []
    const count = (outcome: ReturnType<TestCase['outcome']>) =>
      tests.filter((test) => test.outcome() === outcome).length
    const failed = tests.filter((test) => test.outcome() === 'unexpected')
    const seconds = Math.round(result.duration / 1000)
    console.log(
      `${count('expected')} passed, ${failed.length} failed, ${count('flaky')} flaky, ` +
        `${count('skipped')} skipped (${seconds}s)`,
    )
    for (const test of failed) {
      const place = `${path.relative(process.cwd(), test.location.file)}:${test.location.line}`
      const project = test.parent.project()?.name ?? ''
      console.log(`\nFAIL [${project}] ${place} > ${test.titlePath().slice(3).join(' > ')}`)
      const message = stripVTControlCharacters(test.results.at(-1)?.error?.message ?? '')
      const shown = message.split('\n').filter(Boolean).slice(0, errorLines)
      console.log(shown.map((line) => `  ${line}`).join('\n'))
    }
  }
}
