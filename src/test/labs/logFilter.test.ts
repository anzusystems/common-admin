import { beforeEach, describe, expect, it } from 'vitest'
import { applyLogTypeVisibility, resetLogFilterRegistry, useLogFilter } from '@/labs/log/logFilter'
import { LogType } from '@/labs/log/logType'

const AUDIT_ONLY = ['resourceName', 'resourceIds'] as const

beforeEach(() => {
  resetLogFilterRegistry()
})

describe('useLogFilter registry', () => {
  it('hands the same instance back for one system', () => {
    expect(useLogFilter('weather', undefined)).toBe(useLogFilter('weather', undefined))
  })

  it('keeps systems apart, so one cannot overwrite another', () => {
    const weather = useLogFilter('weather', undefined)
    const brick = useLogFilter('brick', undefined)

    expect(weather).not.toBe(brick)

    weather.filterData.contextId = 'only-weather'
    expect(brick.filterData.contextId).toBeNull()
  })

  it('survives a remount, which is what carries a filter across a type switch', () => {
    useLogFilter('weather', undefined).filterData.contextId = 'abc'

    expect(useLogFilter('weather', undefined).filterData.contextId).toBe('abc')
  })
})

describe('defaultTimeWindow', () => {
  it('leaves the interval unbounded and optional when no window is given', () => {
    const { filterConfig } = useLogFilter('weather', undefined)

    expect(filterConfig.fields.datetimeFrom.default).toBeNull()
    expect(filterConfig.fields.datetimeFrom.mandatory).toBe(false)
    expect(filterConfig.fields.datetimeTo.mandatory).toBe(false)
  })

  it('makes both ends mandatory when one is given, which is what forces it into the query', () => {
    const { filterConfig } = useLogFilter('dam', { from: '2026-09-17T00:00:00.000Z', to: '2026-09-18T23:59:59.000Z' })

    expect(filterConfig.fields.datetimeFrom.default).toBe('2026-09-17T00:00:00.000Z')
    expect(filterConfig.fields.datetimeTo.default).toBe('2026-09-18T23:59:59.000Z')
    expect(filterConfig.fields.datetimeFrom.mandatory).toBe(true)
    expect(filterConfig.fields.datetimeTo.mandatory).toBe(true)
  })
})

describe('applyLogTypeVisibility', () => {
  it('excludes, hides and de-chips the audit-only fields under app', () => {
    const filter = useLogFilter('weather', undefined)

    applyLogTypeVisibility(filter, LogType.App)

    AUDIT_ONLY.forEach((name) => {
      expect(filter.filterConfig.fields[name].exclude, name).toBe(true)
      expect(filter.filterConfig.fields[name].render.skip, name).toBe(true)
      // The third flag is the one that is easy to forget: without it the chip stays in the bar,
      // advertising a filter that is not being sent, and its close button destroys the value.
      expect(filter.filterConfig.fields[name].render.selected, name).toBe(false)
    })
  })

  it('brings all three back under audit', () => {
    const filter = useLogFilter('weather', undefined)

    applyLogTypeVisibility(filter, LogType.App)
    applyLogTypeVisibility(filter, LogType.Audit)

    AUDIT_ONLY.forEach((name) => {
      expect(filter.filterConfig.fields[name].exclude, name).toBe(false)
      expect(filter.filterConfig.fields[name].render.skip, name).toBe(false)
      expect(filter.filterConfig.fields[name].render.selected, name).toBe(true)
    })
  })

  it('never touches the value, so a round trip through app keeps what the user typed', () => {
    const filter = useLogFilter('weather', undefined)
    filter.filterData.resourceName = 'article'

    applyLogTypeVisibility(filter, LogType.App)
    applyLogTypeVisibility(filter, LogType.Audit)

    expect(filter.filterData.resourceName).toBe('article')
  })

  it('leaves the shared fields alone', () => {
    const filter = useLogFilter('weather', undefined)

    applyLogTypeVisibility(filter, LogType.App)

    expect(filter.filterConfig.fields.contextId.exclude).toBe(false)
    expect(filter.filterConfig.fields.levelName.exclude).toBe(false)
  })
})
