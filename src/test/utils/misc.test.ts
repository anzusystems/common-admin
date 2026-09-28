import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { booleanToInteger, parseBoolean } from '@/utils/boolean'
import { numberToString } from '@/utils/number'
import { formatJson } from '@/utils/json'
import { isOneOf } from '@/utils/enum'
import { eventClickBlur } from '@/utils/event'
import { browserHistoryReplaceUrlByRouter, browserHistoryReplaceUrlByString } from '@/utils/history'
import { isValidHTTPStatus } from '@/utils/response'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('utils/boolean', () => {
  it('booleanToInteger maps to 1 and 0', () => {
    expect(booleanToInteger(true)).toBe(1)
    expect(booleanToInteger(false)).toBe(0)
  })

  it('parseBoolean reads the usual spellings', () => {
    for (const value of [true, 'true', 'TRUE', ' yes ', '1', 1, -1, 'on']) {
      expect(parseBoolean(value), String(value)).toBe(true)
    }
    for (const value of [false, 'false', ' False ', 'no', 'NO', '0', 0, '', null, undefined, NaN, {}, []]) {
      expect(parseBoolean(value), String(value)).toBe(false)
    }
  })

  // '' is false; the same after trimming should be too.
  it('parseBoolean reads a blank string as false', () => {
    expect(parseBoolean('   ')).toBe(false)
  })
})

describe('utils/number', () => {
  it('numberToString stringifies', () => {
    expect(numberToString(0)).toBe('0')
    expect(numberToString(-1.5)).toBe('-1.5')
    expect(numberToString(-0)).toBe('0')
    expect(numberToString(NaN)).toBe('NaN')
  })
})

describe('utils/json', () => {
  it('pretty-prints JSON with two spaces', () => {
    expect(formatJson('{"a":1,"b":[1,2]}')).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}')
  })

  it('hands back what is not JSON', () => {
    expect(formatJson('')).toBe('')
    expect(formatJson('not json')).toBe('not json')
    expect(formatJson('{"a":')).toBe('{"a":')
  })

  it('keeps JSON scalars and unicode', () => {
    expect(formatJson('null')).toBe('null')
    expect(formatJson('"žltý"')).toBe('"žltý"')
    expect(formatJson('{"t":"\\u017e"}')).toBe('{\n  "t": "ž"\n}')
  })

  // Documented: a log body goes through JSON.parse, so an integer beyond 2^53 is printed rounded.
  it('rounds integers beyond 2^53', () => {
    expect(formatJson('{"id":12345678901234567891}')).toBe('{\n  "id": 12345678901234567000\n}')
  })
})

describe('utils/enum', () => {
  it('isOneOf checks membership strictly', () => {
    expect(isOneOf('a', ['a', 'b'])).toBe(true)
    expect(isOneOf('c', ['a', 'b'])).toBe(false)
    expect(isOneOf<unknown>(1, ['1'])).toBe(false)
    expect(isOneOf(NaN, [NaN])).toBe(true)
    expect(isOneOf('a', [])).toBe(false)
  })
})

describe('utils/event', () => {
  it('blurs the element the handler is bound to', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()
    expect(document.activeElement).toBe(button)
    button.addEventListener('click', (event) => eventClickBlur(event))
    button.click()
    expect(document.activeElement).not.toBe(button)
    button.remove()
  })

  it('ignores a missing event or target', () => {
    expect(() => eventClickBlur()).not.toThrow()
    expect(() => eventClickBlur(new Event('click'))).not.toThrow()
  })
})

describe('utils/history', () => {
  it('replaces the URL and keeps the state', () => {
    const spy = vi.spyOn(history, 'replaceState').mockImplementation(() => {})
    browserHistoryReplaceUrlByString('/articles?page=2')
    expect(spy).toHaveBeenCalledWith(history.state, '', '/articles?page=2')
  })

  it('resolves a route before replacing the URL', () => {
    const spy = vi.spyOn(history, 'replaceState').mockImplementation(() => {})
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/articles/:id', name: 'article', component: { render: () => null } }],
    })
    browserHistoryReplaceUrlByRouter(router, { name: 'article', params: { id: 5 }, query: { tab: 'seo' } })
    expect(spy).toHaveBeenCalledWith(history.state, '', '/articles/5?tab=seo')
  })
})

describe('utils/response', () => {
  it('accepts only the success codes', () => {
    for (const code of [200, 201, 202, 204]) expect(isValidHTTPStatus(code)).toBe(true)
    for (const code of [203, 206, 301, 304, 400, 404, 500, 0]) expect(isValidHTTPStatus(code)).toBe(false)
  })
})
