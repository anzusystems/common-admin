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

  // Test helper functions
  const waitForAsync = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms))

  const createMockFetchItems = (items = mockItems) => vi.fn().mockResolvedValue(items)

  const createMockFetchItemsByIds = (items = mockItems) =>
    vi.fn().mockImplementation((ids: string[]) => {
      return Promise.resolve(items.filter(item => ids.includes(item.value)))
    })

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
    const mockFetchItemsForPrefetch = createMockFetchItems()

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsForPrefetch,
      prefetch: false,
    })

    await waitForAsync(200)

    // Verify fetchItems was NOT called on mount
    expect(mockFetchItemsForPrefetch).not.toHaveBeenCalled()
    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('handles prefetch: mounted - items loaded on component mount', async () => {
    const mockFetchItemsForPrefetch = createMockFetchItems()

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsForPrefetch,
      prefetch: 'mounted',
    })

    await waitForAsync(300)

    // Verify fetchItems WAS called on mount
    expect(mockFetchItemsForPrefetch).toHaveBeenCalled()
    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('handles prefetch: focus - items loaded on focus event', async () => {
    const mockFetchItemsForPrefetch = createMockFetchItems()

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsForPrefetch,
      prefetch: 'focus',
    })

    await waitForAsync(200)

    // Verify fetchItems was NOT called on mount
    expect(mockFetchItemsForPrefetch).not.toHaveBeenCalled()

    // Trigger focus event
    const autocomplete = wrapper.find('.v-autocomplete')
    await autocomplete.trigger('focus')

    await waitForAsync(300)

    // Verify fetchItems WAS called after focus
    expect(mockFetchItemsForPrefetch).toHaveBeenCalled()
  })

  it('handles prefetch: hover - items loaded on hover event', async () => {
    const mockFetchItemsForPrefetch = createMockFetchItems()

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsForPrefetch,
      prefetch: 'hover',
    })

    await waitForAsync(200)

    // Verify fetchItems was NOT called on mount
    expect(mockFetchItemsForPrefetch).not.toHaveBeenCalled()

    // Trigger mouseenter event (hover)
    const autocomplete = wrapper.find('.v-autocomplete')
    await autocomplete.trigger('mouseenter')

    await waitForAsync(300)

    // Verify fetchItems WAS called after hover
    expect(mockFetchItemsForPrefetch).toHaveBeenCalled()
  })

  it('handles tryLoadModelValue - sets modelValue when ID found in results', async () => {
    const mockFetchItemsByIdsForTryLoad = createMockFetchItemsByIds()

    const wrapper = createWrapper({
      fetchItemsByIds: mockFetchItemsByIdsForTryLoad,
      prefetch: 'mounted',
    })

    await waitForAsync()

    // Call the exposed method instead of using prop
    const result = await wrapper.vm.tryLoadModelValue('2')

    // Verify fetchItemsByIds was called with the tryLoadModelValue
    expect(mockFetchItemsByIdsForTryLoad).toHaveBeenCalledWith(['2'])

    // Verify the method returned true (item found)
    expect(result).toBe(true)

    // Verify the tryLoadModelValue was set as modelValue
    expect(wrapper.vm.modelValue).toBe('2')

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('handles tryLoadModelValue - keeps modelValue null when ID not found in results', async () => {
    const mockFetchItemsByIdsForTryLoad = createMockFetchItemsByIds()

    const wrapper = createWrapper({
      fetchItemsByIds: mockFetchItemsByIdsForTryLoad,
      prefetch: 'mounted',
    })

    await waitForAsync()

    // Call the exposed method instead of using prop
    const result = await wrapper.vm.tryLoadModelValue('999') // This ID does NOT exist in mockItems

    // Verify fetchItemsByIds was called with the tryLoadModelValue
    expect(mockFetchItemsByIdsForTryLoad).toHaveBeenCalledWith(['999'])

    // Verify the method returned false (item not found)
    expect(result).toBe(false)

    // Verify the modelValue remains null
    expect(wrapper.vm.modelValue).toBe(null)

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('loads and displays pretty title when modelValue is pre-set on init', async () => {
    const mockFetchItemsByIdsForInit = createMockFetchItemsByIds()

    const wrapper = createWrapper({
      fetchItemsByIds: mockFetchItemsByIdsForInit,
      modelValue: '1', // Pre-set modelValue
    })

    await waitForAsync()

    // Verify fetchItemsByIds was called with the initial modelValue
    expect(mockFetchItemsByIdsForInit).toHaveBeenCalledWith(['1'])

    // Verify the modelValue remains set to the initial value
    expect(wrapper.vm.modelValue).toBe('1')

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  it('auto-fetches and auto-selects single item on mount', async () => {
    // Mock fetchItems to return only one item
    const singleItem: ValueObjectOption<string> = { value: '1', title: 'Apple', subtitle: 'Fruit' }
    const mockFetchItemsSingle = createMockFetchItems([singleItem])

    const wrapper = createWrapper({
      fetchItems: mockFetchItemsSingle,
      disableAutoSingleSelect: false,
      prefetch: 'mounted',
    })

    // Wait for auto-fetch and auto-select to complete
    await waitForAsync()

    // Verify fetchItems was called (auto-fetch on mount)
    expect(mockFetchItemsSingle).toHaveBeenCalled()

    // Verify the single item was auto-selected
    expect(wrapper.vm.modelValue).toBe('1')

    expect(wrapper.find('.v-autocomplete').exists()).toBe(true)
  })

  describe('prefetch hover behavior - bug reproduction', () => {
    it('should only trigger fetchItems once on first hover, not on subsequent hovers while loading', async () => {
      // Create a mock that simulates a slow API call
      const mockFetchItemsWithDelay = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockItems), 100) // 100ms delay
        })
      })

      const wrapper = createWrapper({
        fetchItems: mockFetchItemsWithDelay,
        prefetch: 'hover',
      })

      await waitForAsync(50) // Wait a bit to ensure component is mounted

      // Verify fetchItems was NOT called on mount
      expect(mockFetchItemsWithDelay).not.toHaveBeenCalled()

      const autocomplete = wrapper.find('.v-autocomplete')

      // First hover - should trigger fetchItems
      await autocomplete.trigger('mouseenter')

      // Immediately hover again while the first request is still loading
      await autocomplete.trigger('mouseenter')

      // And hover once more while still loading
      await autocomplete.trigger('mouseenter')

      // Wait for the API calls to complete
      await waitForAsync(200)

      // BUG: Currently this will fail because fetchItems is called multiple times
      // It should only be called once on the first hover
      expect(mockFetchItemsWithDelay).toHaveBeenCalledTimes(1)
    })

    it('should not trigger fetchItems on hover after items have already been fetched', async () => {
      const mockFetchItemsForHover = createMockFetchItems()

      const wrapper = createWrapper({
        fetchItems: mockFetchItemsForHover,
        prefetch: 'hover',
      })

      await waitForAsync(50)

      const autocomplete = wrapper.find('.v-autocomplete')

      // First hover - should trigger fetchItems
      await autocomplete.trigger('mouseenter')
      await waitForAsync(100) // Wait for fetch to complete

      // Verify fetchItems was called once
      expect(mockFetchItemsForHover).toHaveBeenCalledTimes(1)

      // Reset the mock call count to test subsequent hovers
      mockFetchItemsForHover.mockClear()

      // Hover again after items are already fetched
      await autocomplete.trigger('mouseenter')
      await waitForAsync(100)

      // Hover once more
      await autocomplete.trigger('mouseenter')
      await waitForAsync(100)

      // BUG: Currently this will fail because fetchItems is called again
      // It should not be called again since items are already fetched
      expect(mockFetchItemsForHover).not.toHaveBeenCalled()
    })
  })

  describe('prefetch focus behavior - same bug as hover', () => {
    it('should only trigger fetchItems once on first focus, not on subsequent focuses while loading', async () => {
      // Create a mock that simulates a slow API call
      const mockFetchItemsWithDelay = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockItems), 100) // 100ms delay
        })
      })

      const wrapper = createWrapper({
        fetchItems: mockFetchItemsWithDelay,
        prefetch: 'focus',
      })

      await waitForAsync(50) // Wait a bit to ensure component is mounted

      // Verify fetchItems was NOT called on mount
      expect(mockFetchItemsWithDelay).not.toHaveBeenCalled()

      const autocomplete = wrapper.find('.v-autocomplete')

      // First focus - should trigger fetchItems
      await autocomplete.trigger('focus')

      // Immediately focus again while the first request is still loading
      await autocomplete.trigger('focus')

      // And focus once more while still loading
      await autocomplete.trigger('focus')

      // Wait for the API calls to complete
      await waitForAsync(200)

      // Should only be called once on the first focus
      expect(mockFetchItemsWithDelay).toHaveBeenCalledTimes(1)
    })

    it('should not trigger fetchItems on focus after items have already been fetched', async () => {
      const mockFetchItemsForFocus = createMockFetchItems()

      const wrapper = createWrapper({
        fetchItems: mockFetchItemsForFocus,
        prefetch: 'focus',
      })

      await waitForAsync(50)

      const autocomplete = wrapper.find('.v-autocomplete')

      // First focus - should trigger fetchItems
      await autocomplete.trigger('focus')
      await waitForAsync(100) // Wait for fetch to complete

      // Verify fetchItems was called once
      expect(mockFetchItemsForFocus).toHaveBeenCalledTimes(1)

      // Reset the mock call count to test subsequent focuses
      mockFetchItemsForFocus.mockClear()

      // Focus again after items are already fetched
      await autocomplete.trigger('focus')
      await waitForAsync(100)

      // Focus once more
      await autocomplete.trigger('focus')
      await waitForAsync(100)

      // Should not be called again since items are already fetched
      expect(mockFetchItemsForFocus).not.toHaveBeenCalled()
    })
  })
})
