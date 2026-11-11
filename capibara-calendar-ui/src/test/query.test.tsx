import { useQuery } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderApp } from './render'

function Probe({ queryFn }: { queryFn: () => Promise<string> }) {
  const { data, isError } = useQuery({ queryKey: ['probe'], queryFn })
  if (isError) return <p>failed</p>
  return <p>{data ?? 'loading'}</p>
}

it('provides a query client to the tree', async () => {
  renderApp(<Probe queryFn={() => Promise.resolve('loaded')} />)
  expect(await screen.findByText('loaded')).toBeInTheDocument()
})

it('does not retry failed queries in tests', async () => {
  const queryFn = vi.fn(() => Promise.reject(new Error('boom')))
  renderApp(<Probe queryFn={queryFn} />)
  expect(await screen.findByText('failed')).toBeInTheDocument()
  expect(queryFn).toHaveBeenCalledTimes(1)
})
