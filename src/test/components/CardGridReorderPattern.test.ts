import { describe, it, expect } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'

interface MockImage extends Record<string, any> {
  id: number
  key: string
  position: number
  title: string
}

const buildImages = (count = 4): MockImage[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    key: `img-${i + 1}`,
    position: i + 1,
    title: `Image ${i + 1}`,
  }))

const mountPattern = (initial: MockImage[] = buildImages()) => {
  const model = ref<MockImage[]>(initial)
  const mode = ref<'view' | 'reorder'>('view')

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          ASortableListEditor<MockImage>,
          {
            modelValue: model.value,
            'onUpdate:modelValue': (v: MockImage[]) => {
              model.value = v
            },
            mode: mode.value,
            'onUpdate:mode': (v: 'view' | 'reorder') => {
              mode.value = v
            },
            keyField: 'key',
            positionField: 'position',
            updatePosition: true,
            showAddButton: false,
            showDeleteButton: false,
            showEditButton: false,
          },
          {
            'view-body': () =>
              h(
                'div',
                { class: 'card-grid', 'data-test': 'card-grid' },
                model.value.map((image) =>
                  h('div', { key: image.key, class: 'card' }, [
                    h('div', { class: 'card__title' }, image.title),
                  ]),
                ),
              ),
            'item-compact': ({ raw }: { raw: MockImage }) =>
              h('div', { class: 'reorder-row' }, [
                h('div', { class: 'reorder-row__title' }, raw.title),
              ]),
          },
        )
    },
  })

  const wrapper = mount(Host)
  return { wrapper, model, mode }
}

const findEditor = (wrapper: VueWrapper) =>
  wrapper.findComponent(
    ASortableListEditor as unknown as Parameters<typeof wrapper.findComponent>[0],
  ) as VueWrapper

const clickByText = async (wrapper: VueWrapper, fragment: string) => {
  const btn = wrapper
    .findAll('button')
    .find((b) => b.text().toLowerCase().includes(fragment.toLowerCase()))
  if (!btn) throw new Error(`Could not find button containing "${fragment}"`)
  await btn.trigger('click')
}

const findReorderToggle = (wrapper: VueWrapper) =>
  wrapper
    .find('.a-le-header')
    .findAll('button')
    .find((b) => {
      const txt = b.text().toLowerCase()
      return txt.includes('reorder') || b.find('.mdi-sort').exists()
    })

describe('Card-grid + reorder mode pattern (#view-body slot)', () => {
  describe('view mode', () => {
    it('renders the #view-body slot content with all rows', () => {
      const { wrapper, mode } = mountPattern()
      expect(mode.value).toBe('view')
      expect(wrapper.find('[data-test="card-grid"]').exists()).toBe(true)
      expect(wrapper.findAll('.card')).toHaveLength(4)
    })

    it('renders the editor header with the built-in Reorder toggle', () => {
      const { wrapper } = mountPattern()
      expect(wrapper.find('.a-le-header').exists()).toBe(true)
      expect(findReorderToggle(wrapper)).toBeTruthy()
    })

    it('does not render the default rows-container while in view mode with the slot', () => {
      const { wrapper } = mountPattern()
      expect(wrapper.find('.a-sortable-list-editor__rows').exists()).toBe(false)
      // No reorder-mode chrome is shown
      expect(wrapper.find('.a-le-action--up').exists()).toBe(false)
      expect(wrapper.find('.a-le-action--down').exists()).toBe(false)
    })
  })

  describe('entering reorder mode via the editor header', () => {
    it('clicking the editor Reorder button flips to reorder mode and shows the rows', async () => {
      const { wrapper, mode } = mountPattern()
      const toggle = findReorderToggle(wrapper)!
      expect(toggle).toBeTruthy()
      await toggle.trigger('click')
      await flushPromises()

      expect(mode.value).toBe('reorder')
      expect(wrapper.find('[data-test="card-grid"]').exists()).toBe(false)
      expect(wrapper.find('.a-sortable-list-editor__rows').exists()).toBe(true)
      expect(wrapper.findAll('.a-le-action--up').length).toBeGreaterThan(0)
    })

    it('renders consumer compact rows in reorder mode', async () => {
      const { wrapper } = mountPattern()
      await findReorderToggle(wrapper)!.trigger('click')
      await flushPromises()
      const rows = wrapper.findAll('.reorder-row')
      expect(rows).toHaveLength(4)
      expect(rows[0].text()).toContain('Image 1')
    })
  })

  describe('cancel flow', () => {
    it('reverts the array and mode when Cancel is clicked', async () => {
      const { wrapper, model, mode } = mountPattern()
      await findReorderToggle(wrapper)!.trigger('click')
      await flushPromises()

      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      expect(model.value.map((i) => i.id)).toEqual([2, 1, 3, 4])

      await clickByText(wrapper, 'cancel')
      await flushPromises()

      expect(mode.value).toBe('view')
      expect(model.value.map((i) => i.id)).toEqual([1, 2, 3, 4])
      expect(findEditor(wrapper).emitted('reorder-cancel')).toBeTruthy()
      expect(wrapper.find('[data-test="card-grid"]').exists()).toBe(true)
    })
  })

  describe('apply flow', () => {
    it('commits new order, renumbers positions, and re-shows the slot', async () => {
      const { wrapper, model, mode } = mountPattern()
      await findReorderToggle(wrapper)!.trigger('click')
      await flushPromises()

      await wrapper.findAll('.a-le-action--down')[0].trigger('click')
      await wrapper.findAll('.a-le-action--down')[1].trigger('click')

      await clickByText(wrapper, 'apply')
      await flushPromises()

      expect(mode.value).toBe('view')
      expect(model.value.map((i) => i.id)).toEqual([2, 3, 1, 4])
      expect(model.value.map((i) => i.position)).toEqual([1, 2, 3, 4])
      expect(findEditor(wrapper).emitted('reorder-applied')).toBeTruthy()
      expect(wrapper.find('[data-test="card-grid"]').exists()).toBe(true)
      expect(wrapper.find('.a-sortable-list-editor__rows').exists()).toBe(false)
    })
  })

  describe('no #view-body slot (default behaviour preserved)', () => {
    it('falls back to the editor default rows in view mode when slot is absent', () => {
      const model = ref<MockImage[]>(buildImages())
      const mode = ref<'view' | 'reorder'>('view')
      const Host = defineComponent({
        setup() {
          return () =>
            h(ASortableListEditor<MockImage>, {
              modelValue: model.value,
              'onUpdate:modelValue': (v: MockImage[]) => {
                model.value = v
              },
              mode: mode.value,
              'onUpdate:mode': (v: 'view' | 'reorder') => {
                mode.value = v
              },
              keyField: 'key',
              positionField: 'position',
            })
        },
      })
      const wrapper = mount(Host)
      expect(wrapper.find('.a-sortable-list-editor__rows').exists()).toBe(true)
      expect(wrapper.findAll('.a-le-row')).toHaveLength(4)
    })
  })
})
