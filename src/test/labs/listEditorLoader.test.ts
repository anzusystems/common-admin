import { describe, expect, it } from 'vitest'
import { loadListEditor, withTimeout } from '@/labs/filters/listEditorLoader'

describe('withTimeout', () => {
  it('rejects once the time is up and the promise has not settled', async () => {
    await expect(withTimeout(new Promise(() => {}), 10, 'too slow')).rejects.toThrow('too slow')
  })

  it('passes the value through when it comes in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'too slow')).resolves.toBe(42)
  })

  it('passes a rejection through as it is', async () => {
    const failure = new Error('chunk failed')
    await expect(withTimeout(Promise.reject(failure), 1000, 'too slow')).rejects.toBe(failure)
  })
})

describe('loadListEditor', () => {
  it('resolves to the list editor component', async () => {
    const component = (await loadListEditor()) as { __name?: string; name?: string }
    expect(component.__name ?? component.name).toBe('ASortableListEditor')
  })
})
