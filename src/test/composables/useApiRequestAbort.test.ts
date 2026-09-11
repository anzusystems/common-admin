import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { useApiRequest } from '@/labs/api/useApiRequest'

// The abort controller lived in a single variable, so overlapping calls overwrote it and
// abortRequest() could end up cancelling nothing at all.

const deferred = () => {
  let settle: (value: unknown) => void = () => undefined
  const promise = new Promise((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

const buildClient = () => {
  const signals: AbortSignal[] = []
  const pending: Array<ReturnType<typeof deferred>> = []
  const request = vi.fn((config: { signal: AbortSignal }) => {
    signals.push(config.signal)
    const d = deferred()
    pending.push(d)
    return d.promise
  })
  const client = () => ({ request }) as unknown as AxiosInstance
  return { client, signals, pending }
}

const buildApi = (client: () => AxiosInstance) =>
  useApiRequest({
    client,
    method: 'get',
    system: 'test',
    entity: 'test',
    urlTemplate: '/test',
    silentConsoleError: true,
  })

describe('useApiRequest abort with overlapping calls', () => {
  it('aborts every in-flight request, not just the last one', async () => {
    const { client, signals } = buildClient()
    const { executeRequest, abortRequest } = buildApi(client)

    void executeRequest().catch(() => undefined)
    void executeRequest().catch(() => undefined)
    expect(signals).toHaveLength(2)

    abortRequest()

    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(true)
  })

  it('a settled request no longer gets aborted, so nothing accumulates', async () => {
    const { client, signals, pending } = buildClient()
    const { executeRequest, abortRequest } = buildApi(client)

    const first = executeRequest().catch(() => undefined)
    void executeRequest().catch(() => undefined)

    pending[0].settle({ status: 200, data: {} })
    await first

    abortRequest()

    expect(signals[0].aborted).toBe(false)
    expect(signals[1].aborted).toBe(true)
  })
})
