import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type VNode } from 'vue'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const Under = defineComponent({
  props: {
    mark: { type: String, required: true },
    configName: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    // eslint-disable-next-line vue/no-setup-props-reactivity-loss
    const name = useDamConfigName(props.configName)

    return () => h('div', { 'data-mark': props.mark, 'data-name': name }, slots.default?.())
  },
})
const Between = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('section', slots.default?.()),
})

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const mountTree = (tree: () => VNode) => {
  wrapper = mount(defineComponent({ setup: () => tree }))
}
const names = () =>
  Object.fromEntries(
    wrapper!.findAll('[data-mark]').map((one) => [one.attributes('data-mark'), one.attributes('data-name')])
  )

describe('the DAM configuration a component works under', () => {
  it('is `default` when neither it nor anything above it names one', () => {
    mountTree(() => h(Between, () => h(Under, { mark: 'alone' })))

    expect(names()).toEqual({ alone: 'default' })
  })

  it('is the one it is given', () => {
    mountTree(() => h(Under, { mark: 'named', configName: 'own' }))

    expect(names()).toEqual({ named: 'own' })
  })

  it('is that of the nearest component above that has one, through those that have none', () => {
    mountTree(() =>
      h(Under, { mark: 'top', configName: 'own' }, () =>
        h(Between, () => h(Under, { mark: 'inner' }, () => h(Between, () => h(Under, { mark: 'innermost' }))))
      )
    )

    expect(names()).toEqual({ top: 'own', inner: 'own', innermost: 'own' })
  })

  it('is its own over the inherited one, for itself and what is in it, and for nothing beside it', () => {
    mountTree(() =>
      h(Under, { mark: 'top', configName: 'own' }, () => [
        h(Under, { mark: 'named', configName: 'other' }, () => h(Under, { mark: 'in the named' })),
        h(Under, { mark: 'beside' }),
      ])
    )

    expect(names()).toEqual({ top: 'own', named: 'other', 'in the named': 'other', beside: 'own' })
  })

  it('is `default` where that is the name given, under a component with another', () => {
    mountTree(() =>
      h(Under, { mark: 'top', configName: 'own' }, () =>
        h(Under, { mark: 'named', configName: 'default' }, () => h(Under, { mark: 'in the named' }))
      )
    )

    expect(names()).toEqual({ top: 'own', named: 'default', 'in the named': 'default' })
  })
})
