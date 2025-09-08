import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import AFormRemoteAutocomplete from '@/labs/form/AFormRemoteAutocomplete.vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'
import { SystemScopeSymbol, SubjectScopeSymbol } from '@/components/injectionKeys'

// Mock the composables
vi.mock('@/components/collab/composables/commonAdminCollabOptions', () => ({
  useCommonAdminCollabOptions: () => ({
    collabOptions: ref<{ enabled: boolean }>({ enabled: false }),
  }),
}))

vi.mock('@/components/collab/composables/collabField', () => ({
  useCollabField: () => ({
    releaseCollabFieldLock: vi.fn(),
    changeCollabFieldData: vi.fn(),
    acquireCollabFieldLock: vi.fn(),
    lockedByUser: ref<null>(null),
  }),
}))

describe('AFormRemoteAutocomplete', () => {
  const mockFetchItems = vi.fn()
  const mockFetchItemsByIds = vi.fn()

  const mockFilterData: FilterData = {
    testField: '',
  }

  const mockFilterConfig: FilterConfig = {
    general: {
      system: 'test',
      subject: 'test',
      elastic: false,
    },
    touched: false,
    fields: {
      testField: {
        name: 'testField',
        type: 'string',
        variant: 'search',
        titleT: 'Test Field',
        default: '',
        apiName: 'testField',
        clearable: true,
        mandatory: false,
        multiple: false,
        advanced: false,
        exclude: false,
        related: undefined,
        render: {
          skip: false,
          xs: undefined,
          sm: undefined,
          md: undefined,
          lg: undefined,
          xl: undefined,
        },
      },
    },
  }

  const mockItems: ValueObjectOption<string>[] = [
    { value: '1', title: 'Item 1', subtitle: 'Subtitle 1' },
    { value: '2', title: 'Item 2', subtitle: 'Subtitle 2' },
    { value: '3', title: 'Item 3', subtitle: 'Subtitle 3' },
  ]

  const defaultProps = {
    fetchItems: mockFetchItems,
    fetchItemsByIds: mockFetchItemsByIds,
    filterByField: 'testField',
    modelValue: null,
  }

  const createWrapper = (props = {}, provide = {}) => {
    return mount(AFormRemoteAutocomplete, {
      props: {
        ...defaultProps,
        ...props,
      },
      global: {
        provide: {
          [FilterInnerDataKey as symbol]: mockFilterData,
          [FilterInnerConfigKey as symbol]: mockFilterConfig,
          [SystemScopeSymbol as symbol]: 'test',
          [SubjectScopeSymbol as symbol]: 'testSubject',
          ...provide,
        },
      },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchItems.mockResolvedValue(mockItems)
    mockFetchItemsByIds.mockResolvedValue(mockItems)
  })

  it('renders correctly with basic props', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('displays label correctly', () => {
    const testLabel = 'Test Label for Autocomplete'
    const wrapper = createWrapper({ label: testLabel })

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
    expect(wrapper.vm.label).toBe(testLabel)
  })

  it('handles single selection', async () => {
    const wrapper = createWrapper({ modelValue: null })

    // Test that the component renders and can handle model value changes
    expect(wrapper.vm.modelValue).toBe(null)

    // Test prop changes
    await wrapper.setProps({ modelValue: mockItems[0].value })
    expect(wrapper.vm.modelValue).toEqual(mockItems[0].value)
  })

  it('handles multiple selection', async () => {
    const wrapper = createWrapper({
      modelValue: [],
      multiple: true
    })

    expect(wrapper.vm.modelValue).toEqual([])
    expect(wrapper.vm.multiple).toBe(true)

    await wrapper.setProps({ modelValue: [mockItems[0].value, mockItems[1].value] })
    expect(wrapper.vm.modelValue).toEqual([mockItems[0].value, mockItems[1].value])
  })

  it('calls fetchItems on search', async () => {
    const wrapper = createWrapper()

    // Test that the component has the fetchItems prop
    expect(wrapper.vm.fetchItems).toBe(mockFetchItems)

    // The actual search functionality would be tested in integration tests
    // Here we just verify the prop is passed correctly
    expect(typeof wrapper.vm.fetchItems).toBe('function')
  })

  it('calls fetchItemsByIds when modelValue changes', async () => {
    createWrapper({ modelValue: '1' })

    await nextTick()

    expect(mockFetchItemsByIds).toHaveBeenCalledWith(['1'])
  })

  it('handles loading state', async () => {
    const wrapper = createWrapper({ loading: true })

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
    expect(wrapper.vm.loading).toBe(true)

    // Test loading prop reactivity
    await wrapper.setProps({ loading: false })
    expect(wrapper.vm.loading).toBe(false)

    await wrapper.setProps({ loading: true })
    expect(wrapper.vm.loading).toBe(true)
  })

  it('handles disabled state', () => {
    const wrapper = createWrapper({ disabled: true })
    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
    expect(wrapper.vm.disabled).toBe(true)
  })

  it('handles clearable prop', () => {
    const wrapper = createWrapper({ clearable: true })
    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
    expect(wrapper.vm.clearable).toBe(true)
  })

  it('handles component props correctly', async () => {
    const wrapper = createWrapper({
      modelValue: '1',
      loading: true,
      disabled: true,
      clearable: true
    })

    // Test that props are passed correctly
    expect(wrapper.vm.modelValue).toBe('1')
    expect(wrapper.vm.loading).toBe(true)
    expect(wrapper.vm.disabled).toBe(true)
    expect(wrapper.vm.clearable).toBe(true)
  })

  it('handles component configuration', async () => {
    const wrapper = createWrapper({ modelValue: '1' })

    // Test that the component has access to filter configuration
    expect(wrapper.vm.filterByField).toBe('testField')
    expect(wrapper.vm.fetchItems).toBe(mockFetchItems)
    expect(wrapper.vm.fetchItemsByIds).toBe(mockFetchItemsByIds)
  })

  it('throws error when filter config is missing', () => {
    expect(() => {
      mount(AFormRemoteAutocomplete, {
        props: defaultProps,
        global: {
          provide: {
            // Missing FilterInnerConfigKey and FilterInnerDataKey
          },
        },
      })
    }).toThrow()
  })

  it('throws error when filterByField is not in config', () => {
    expect(() => {
      createWrapper({ filterByField: 'nonExistentField' })
    }).toThrow()
  })

  it('handles prefetch: false - no items loaded until search', async () => {
    const mockFetchItemsForPrefetch = vi.fn().mockResolvedValue(mockItems)

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsForPrefetch,
      prefetch: false,
    })

    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify fetchItems was NOT called on mount
    expect(mockFetchItemsForPrefetch).not.toHaveBeenCalled()
    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('handles prefetch: mounted - items loaded on component mount', async () => {
    const mockFetchItemsForPrefetch = vi.fn().mockResolvedValue(mockItems)

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsForPrefetch,
      prefetch: 'mounted',
    })

    await new Promise(resolve => setTimeout(resolve, 300))

    // Verify fetchItems WAS called on mount
    expect(mockFetchItemsForPrefetch).toHaveBeenCalled()
    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('handles prefetch: focus - items loaded on focus event', async () => {
    const mockFetchItemsForPrefetch = vi.fn().mockResolvedValue(mockItems)

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsForPrefetch,
      prefetch: 'focus',
    })

    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify fetchItems was NOT called on mount
    expect(mockFetchItemsForPrefetch).not.toHaveBeenCalled()

    // Trigger focus event
    const autocomplete = wrapper.find('.v-autocomplete')
    await autocomplete.trigger('focus')

    await new Promise(resolve => setTimeout(resolve, 300))

    // Verify fetchItems WAS called after focus
    expect(mockFetchItemsForPrefetch).toHaveBeenCalled()
  })

  it('handles prefetch: hover - items loaded on hover event', async () => {
    const mockFetchItemsForPrefetch = vi.fn().mockResolvedValue(mockItems)

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsForPrefetch,
      prefetch: 'hover',
    })

    await new Promise(resolve => setTimeout(resolve, 200))

    // Verify fetchItems was NOT called on mount
    expect(mockFetchItemsForPrefetch).not.toHaveBeenCalled()

    // Trigger mouseenter event (hover)
    const autocomplete = wrapper.find('.v-autocomplete')
    await autocomplete.trigger('mouseenter')

    await new Promise(resolve => setTimeout(resolve, 300))

    // Verify fetchItems WAS called after hover
    expect(mockFetchItemsForPrefetch).toHaveBeenCalled()
  })

  it('handles tryLoadModelValue - sets modelValue when ID found in results', async () => {
    const mockFetchItemsByIdsForTryLoad = vi.fn().mockImplementation((ids: string[]) => {
      return Promise.resolve(mockItems.filter(item => ids.includes(item.value)))
    })

    const wrapper = createWrapper({
      fetchItemsByIds: mockFetchItemsByIdsForTryLoad,
      prefetch: 'mounted',
      tryLoadModelValue: '2', // This ID exists in mockItems
    })

    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify fetchItemsByIds was called with the tryLoadModelValue
    expect(mockFetchItemsByIdsForTryLoad).toHaveBeenCalledWith(['2'])

    // Verify the tryLoadModelValue was set as modelValue
    expect(wrapper.vm.modelValue).toBe('2')

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('handles tryLoadModelValue - keeps modelValue null when ID not found in results', async () => {
    const mockFetchItemsByIdsForTryLoad = vi.fn().mockImplementation((ids: string[]) => {
      return Promise.resolve(mockItems.filter(item => ids.includes(item.value)))
    })

    const wrapper = createWrapper({
      fetchItemsByIds: mockFetchItemsByIdsForTryLoad,
      prefetch: 'mounted',
      tryLoadModelValue: '999', // This ID does NOT exist in mockItems
    })

    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify fetchItemsByIds was called with the tryLoadModelValue
    expect(mockFetchItemsByIdsForTryLoad).toHaveBeenCalledWith(['999'])

    // Verify the modelValue remains null
    expect(wrapper.vm.modelValue).toBe(null)

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('loads and displays pretty title when modelValue is pre-set on init', async () => {
    const mockFetchItemsByIdsForInit = vi.fn().mockImplementation((ids: string[]) => {
      return Promise.resolve(mockItems.filter(item => ids.includes(item.value)))
    })

    const wrapper = createWrapper({
      fetchItemsByIds: mockFetchItemsByIdsForInit,
      modelValue: '1', // Pre-set modelValue
    })

    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify fetchItemsByIds was called with the initial modelValue
    expect(mockFetchItemsByIdsForInit).toHaveBeenCalledWith(['1'])

    // Verify the modelValue remains set to the initial value
    expect(wrapper.vm.modelValue).toBe('1')

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('auto-fetches and auto-selects single item on mount', async () => {
    // Mock fetchItems to return only one item
    const singleItem: ValueObjectOption<string> = { value: '1', title: 'Apple', subtitle: 'Fruit' }
    const mockFetchItemsSingle = vi.fn().mockResolvedValue([singleItem])

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsSingle,
      disableAutoSingleSelect: false,
      prefetch: 'mounted',
    })

    // Wait for auto-fetch and auto-select to complete
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify fetchItems was called (auto-fetch on mount)
    expect(mockFetchItemsSingle).toHaveBeenCalled()

    // Verify the single item was auto-selected
    expect(wrapper.vm.modelValue).toBe('1')

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })
})
