import { describe, expect, it } from 'vitest'
import { computed, isRef, ref } from 'vue'
import { defaultOptions, defineBreadcrumbs } from '@/domains/system/composables/breadcrumbs'

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

  it('wraps a getter in a computed that follows what it reads', () => {
    const title = ref('Article 1')
    const breadcrumbs = defineBreadcrumbs(() => [
      { title: 'Articles', routeName: '/(cms)/articles' },
      { title: title.value, routeName: '/(cms)/articles/[id]', id: 1 },
    ])
    expect(isRef(breadcrumbs.items)).toBe(true)
    expect(breadcrumbs.items.value[1].title).toBe('Article 1')
    title.value = 'Renamed'
    expect(breadcrumbs.items.value[1].title).toBe('Renamed')
  })

  it('reads the getter only when the items are read, and once per change', () => {
    const id = ref(1)
    let reads = 0
    const breadcrumbs = defineBreadcrumbs(() => {
      reads += 1
      return [{ title: `Article ${id.value} of ${later}`, routeName: '/(cms)/articles/[id]', id: id.value }]
    })
    // Declared after the call: a getter read at once would throw here, while a page's own computed would not.
    const later = 'the desk'
    expect(reads).toBe(0)
    expect(breadcrumbs.items.value[0].title).toBe('Article 1 of the desk')
    expect(breadcrumbs.items.value[0].id).toBe(1)
    expect(reads).toBe(1)
    id.value = 2
    expect(breadcrumbs.items.value[0].title).toBe('Article 2 of the desk')
    expect(reads).toBe(2)
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
