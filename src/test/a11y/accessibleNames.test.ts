import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h, nextTick } from 'vue'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import AActionDeleteButton from '@/domains/ui/buttons/action/components/AActionDeleteButton.vue'
import ADatatablePagination from '@/domains/filters/datatable/components/ADatatablePagination.vue'
import { DatatablePaginationKey } from '@/domains/filters/utils/filterInjectionKeys'
import { usePagination } from '@/domains/api/composables/pagination'

// Icon-only buttons are asserted by role and accessible name, the way a screen reader (and Playwright)
// finds them: a tooltip gives `aria-describedby`, not a name, and is not rendered until hovered.

let mounted: VueWrapper | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('accessible names of icon-only buttons', () => {
  it('names the close button of the dialog toolbar', async () => {
    mounted = mount(ADialogToolbar, { slots: { default: () => 'Title' }, attachTo: document.body })

    await page.getByRole('button', { name: 'Close' }).click()

    expect(mounted.emitted('cancel')).toHaveLength(1)
  })

  it('names the four paging buttons', async () => {
    const { pagination } = usePagination('id')
    pagination.value = { ...pagination.value, hasNextPage: null, totalCount: 100, rowsPerPage: 25, page: 2 }
    mounted = mount(defineComponent({ setup: () => () => h(ADatatablePagination) }), {
      global: { provide: { [DatatablePaginationKey as symbol]: pagination } },
      attachTo: document.body,
    })

    for (const name of ['First page', 'Previous page', 'Next page', 'Last page']) {
      await expect.element(page.getByRole('button', { name, exact: true })).toBeEnabled()
    }
  })

  it('names the icon variant of an action button, and Esc cancels its confirm dialog', async () => {
    mounted = mount(AActionDeleteButton, { props: { variant: 'icon' }, attachTo: document.body })

    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    const panel = page.getByRole('dialog')
    await expect.element(panel).toBeVisible()
    await expect.element(panel.getByRole('button', { name: 'Close' })).toBeVisible()

    await userEvent.keyboard('{Escape}')
    await nextTick()

    await expect.poll(() => document.querySelector('[data-cy="delete-panel"]')).toBeNull()
    expect(mounted.emitted('deleteRecord')).toBeUndefined()
  })
})
