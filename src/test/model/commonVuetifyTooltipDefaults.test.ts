import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCommonVuetifyConfig } from '@/model/commonVuetifyConfig'

const stubHover = (touchOnly: boolean) =>
  vi
    .spyOn(window, 'matchMedia')
    .mockImplementation(
      (query: string) =>
        ({ matches: query === '(any-hover: none)' ? touchOnly : false, media: query }) as MediaQueryList
    )

afterEach(() => vi.restoreAllMocks())

describe('VTooltip defaults', () => {
  it('keep a tooltip from opening on hover or focus where no input can hover', () => {
    stubHover(true)
    expect(useCommonVuetifyConfig().commonDefaults().VTooltip).toEqual({ openOnHover: false, openOnFocus: false })
  })

  it('leave tooltips alone where a pointer can hover', () => {
    stubHover(false)
    expect(useCommonVuetifyConfig().commonDefaults().VTooltip).toEqual({})
  })
})
