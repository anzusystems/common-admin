import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import { LOG_ENTITY } from '@/labs/log/logApi'
import { LogType, type LogTypeType } from '@/labs/log/logType'
import type { DatetimeUTC } from '@/types/common'
import { isDefined } from '@/utils/common'

export interface LogTimeWindow {
  from: DatetimeUTC
  to: DatetimeUTC
}

/**
 * Fields that only make sense for the audit store. Switching to `app` hides them and keeps them
 * out of the query -- it never clears them, so a value typed here survives a round trip through
 * `app` and is still there when the user comes back.
 */
const AUDIT_ONLY_FIELDS = ['resourceName', 'resourceIds'] as const

/**
 * A factory rather than a constant, because `defaultTimeWindow` cannot be expressed as a seeded
 * value: what makes the window always reach the query is `mandatory` plus `default` on the two
 * interval fields, and both are read out of this array when `createFilter` runs.
 */
const logFilterFields = (window: LogTimeWindow | undefined) =>
  [
    { name: 'levelName' as const, variant: 'in', default: [] },
    { name: 'id' as const, default: null, type: 'string' },
    // Both drawn by hand in the `#search` slot of `ALogFilter`; without `skip` they would appear
    // a second time in the "more" panel.
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
    // Both rendered by hand in the `#search` slot of `ALogFilter`; without `skip` they would be
    // drawn a second time in the "more" panel, where `FilterDetailItem` has no case for
    // `timeInterval` and falls through to `AFilterEmpty`, which prints the bare field name.
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
 * Keyed by system, so `/weather/logs` and `/brick/logs` cannot overwrite each other's values --
 * and deliberately *not* by type, so everything the two stores share (context id, level, time
 * range, user, message) survives a switch between app and audit. That carry-over is the whole
 * reason this is one view instead of two pages.
 *
 * Module level, so the values outlive the component: `createFilterStore` is only a factory, and
 * one created in `setup()` would die with the instance that made it.
 */
const registry = new Map<string, LogFilter>()

export function useLogFilter(system: string, window: LogTimeWindow | undefined): LogFilter {
  const existing = registry.get(system)
  if (existing) return existing

  const fields = logFilterFields(window)
  const created = createFilter(fields, createFilterStore(fields), {
    system: 'common',
    subject: LOG_ENTITY,
  })
  registry.set(system, created)

  return created
}

/**
 * Called on every mount, not only when the type changes. The registry hands back the same
 * `filterConfig` the previous visit left behind, so these flags still describe whichever type was
 * open last. Landing straight on an `app` url after an audit visit -- a link, a bookmark, F5 --
 * would otherwise send that visit's `resourceName` to the app endpoint.
 *
 * Three flags, not two -- `FiltersSelected` hides a chip on `render.selected`, so without the
 * third one the bar would advertise a filter that is not being applied, and its close button
 * would destroy the very value this approach exists to keep.
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
