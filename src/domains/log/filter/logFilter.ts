import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/domains/filters/composables/filterFactory'
import { LOG_ENTITY } from '@/domains/log/api/logApi'
import { LogType, type LogTypeType } from '@/domains/log/composables/logType'
import type { DatetimeUTC } from '@/shared/types/common'
import { isDefined } from '@/shared/utils/common'

export interface LogTimeWindow {
  from: DatetimeUTC
  to: DatetimeUTC
}

/**
 * Fields that only apply to the audit store. Switching to `app` hides them and keeps them out of the query.
 * It never clears them, so a value survives a round trip through `app`.
 */
const AUDIT_ONLY_FIELDS = ['resourceName', 'resourceIds'] as const

/**
 * A factory, not a constant: `defaultTimeWindow` cannot be a seeded value.
 * The window reaches the query via `mandatory` plus `default` on the
 * two interval fields, and `createFilter` reads both from this array.
 */
const logFilterFields = (window: LogTimeWindow | undefined) =>
  [
    { name: 'levelName' as const, variant: 'in', default: [] },
    { name: 'id' as const, default: null, type: 'string' },
    // Both are drawn by hand in the `#search` slot of `ALogFilter`.
    // Without `skip` they would appear again in the "more" panel.
    {
      name: 'contextId' as const,
      apiName: 'context.contextId',
      default: null,
      type: 'string',
      render: { skip: true },
    },
    { name: 'message' as const, variant: 'startsWith', default: null, type: 'string', render: { skip: true } },
    {
      name: 'appVersion' as const,
      variant: 'startsWith',
      apiName: 'context.appVersion',
      default: null,
      type: 'string',
    },
    { name: 'userId' as const, apiName: 'context.userId', default: null, type: 'integer' },
    { name: 'resourceName' as const, apiName: 'context.resourceName', default: null, type: 'string' },
    {
      name: 'resourceIds' as const,
      apiName: 'context.resourceIds',
      variant: 'in',
      default: [],
      type: 'string',
    },
    // Both are drawn by hand in the `#search` slot of `ALogFilter`.
    // Without `skip` they would appear again in the "more" panel.
    // There `FilterDetailItem` has no `timeInterval` case and falls
    // through to `AFilterEmpty`, which prints the bare field name.
    {
      name: 'datetimeFrom' as const,
      apiName: 'datetime',
      type: 'timeInterval',
      related: 'datetimeTo',
      default: window?.from ?? null,
      mandatory: isDefined(window),
      render: { skip: true },
    },
    {
      name: 'datetimeTo' as const,
      apiName: 'datetime',
      type: 'timeInterval',
      exclude: true,
      default: window?.to ?? null,
      mandatory: isDefined(window),
      render: { skip: true },
    },
  ] satisfies readonly MakeFilterOption[]

type LogFilterFields = ReturnType<typeof logFilterFields>

export interface LogFilter {
  filterConfig: FilterConfig<LogFilterFields>
  filterData: FilterData<LogFilterFields>
}

/**
 * Keyed by system, so `/weather/logs` and `/brick/logs` do not overwrite each other.
 * Not keyed by type, so shared fields (context id, level, time
 * range, user, message) survive a switch between app and audit.
 * Module level, so values outlive the component. `createFilterStore` is
 * only a factory, and one created in `setup()` would die with the instance.
 */
const registry = new Map<string, LogFilter>()

export function useLogFilter(system: string, window: LogTimeWindow | undefined): LogFilter {
  const existing = registry.get(system)
  if (existing) {
    if (window) {
      const { fields } = existing.filterConfig
      // A value still at the old default was never chosen by the user, so it moves with the window.
      if (existing.filterData.datetimeFrom === fields.datetimeFrom.default)
        existing.filterData.datetimeFrom = window.from
      if (existing.filterData.datetimeTo === fields.datetimeTo.default) existing.filterData.datetimeTo = window.to
      fields.datetimeFrom.default = window.from
      fields.datetimeTo.default = window.to
    }
    return existing
  }

  const fields = logFilterFields(window)
  const created = createFilter(fields, createFilterStore(fields), {
    system: 'common',
    subject: LOG_ENTITY,
  })
  registry.set(system, created)

  return created
}

/**
 * Called on every mount, not only on a type change. The registry returns the
 * `filterConfig` the last visit left, so the flags describe that visit's type.
 * Otherwise landing on an `app` url after an audit visit would send `resourceName` to the app endpoint.
 * Three flags: `FiltersSelected` hides a chip on `render.selected`. Without it the
 * bar shows an unapplied filter, and its close button would destroy the kept value.
 */
export const applyLogTypeVisibility = (filter: LogFilter, type: LogTypeType): void => {
  const hide = type !== LogType.Audit

  AUDIT_ONLY_FIELDS.forEach((name) => {
    const field = filter.filterConfig.fields[name]
    field.exclude = hide
    field.render.skip = hide
    field.render.selected = !hide
  })
}

/** For tests and for anything that needs a clean slate; nothing in the views calls it. */
export const resetLogFilterRegistry = (): void => {
  registry.clear()
}
