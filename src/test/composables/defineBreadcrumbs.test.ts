import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { defaultOptions, defineBreadcrumbs } from '@/composables/system/breadcrumbs'

describe('defineBreadcrumbs', () => {
  it('keeps the computed items as given', () => {
    const title = ref('Article 1')
    const items = computed(() => [
      { title: 'Articles', routeName: '/(cms)/articles' },
      { title: title.value, routeName: '/(cms)/articles/[id]', id: 1 },
    ])
    const breadcrumbs = defineBreadcrumbs(items)
    expect(breadcrumbs.items).toBe(items)
    title.value = 'Renamed'
    expect(breadcrumbs.items.value[1].title).toBe('Renamed')
  })

  it('defaults to an unlinked last item', () => {
    expect(defineBreadcrumbs(computed(() => [])).options).toEqual({ linkLastItem: false })
  })

  it('takes options over the defaults', () => {
    expect(
      defineBreadcrumbs(
        computed(() => []),
        { linkLastItem: true }
      ).options
    ).toEqual({ linkLastItem: true })
  })

  it('gives each call its own options and leaves the defaults alone', () => {
    const a = defineBreadcrumbs(computed(() => []))
    const b = defineBreadcrumbs(
      computed(() => []),
      { linkLastItem: true }
    )
    a.options.linkLastItem = true
    expect(a.options).not.toBe(b.options)
    expect(defaultOptions.linkLastItem).toBe(false)
  })

  it('keeps DocIds and route params on items', () => {
    const items = computed(() => [
      {
        title: 'Asset',
        routeName: '/assets/[id]',
        id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
        routeParams: { tab: 1 },
      },
    ])
    expect(defineBreadcrumbs(items).items.value[0]).toMatchObject({ routeParams: { tab: 1 } })
  })
})
