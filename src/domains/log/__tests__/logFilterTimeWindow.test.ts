import { beforeEach, describe, expect, it } from 'vitest'
import { generateListQuery } from '@/domains/api/composables/useApiFetchList'
import { resetLogFilterRegistry, useLogFilter } from '@/domains/log/filter/logFilter'
import { usePagination } from '@/domains/api/composables/pagination'

const DAY1 = { from: '2026-09-16T22:00:00.000Z', to: '2026-09-17T21:59:59.000Z' }
const DAY2 = { from: '2026-09-17T22:00:00.000Z', to: '2026-09-18T21:59:59.000Z' }

beforeEach(() => resetLogFilterRegistry())

const query = (filter: ReturnType<typeof useLogFilter>) => {
  const { pagination } = usePagination(null)
  return generateListQuery(pagination, filter.filterData, filter.filterConfig)
}

describe('a mandatory time window with both ends null', () => {
  it('sends the full default window, not a zero-width one', () => {
    const filter = useLogFilter('dam', DAY1)
    filter.filterData.datetimeFrom = null
    filter.filterData.datetimeTo = null

    expect(query(filter)).toBe(`?limit=25&offset=0&filter_gte[datetime]=${DAY1.from}&filter_lte[datetime]=${DAY1.to}`)
  })
})

describe('useLogFilter on a later mount', () => {
  it('uses the window of the current mount, not the first one', () => {
    useLogFilter('dam', DAY1) // first visit, day 1
    const second = useLogFilter('dam', DAY2) // app left open past midnight, list opened again

    expect(second.filterConfig.fields.datetimeTo.default).toBe(DAY2.to)
    expect(query(second)).toContain(`filter_lte[datetime]=${DAY2.to}`)
  })

  it('keeps a value the user chose', () => {
    const first = useLogFilter('dam', DAY1)
    first.filterData.datetimeFrom = '2026-09-01T00:00:00.000Z'
    const second = useLogFilter('dam', DAY2)

    expect(second.filterData.datetimeFrom).toBe('2026-09-01T00:00:00.000Z')
    expect(second.filterData.datetimeTo).toBe(DAY2.to)
  })
})
