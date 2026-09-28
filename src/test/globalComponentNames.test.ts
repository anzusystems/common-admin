import { describe, expect, expectTypeOf, it } from 'vitest'
import { createApp, h, nextTick, resolveComponent } from 'vue'
import { createVuetify } from 'vuetify'
import AnzuSystemsCommonAdmin from '@/AnzuSystemsCommonAdmin'
import { globalComponentNames } from '@/eslint/globalComponentNames.mjs'
import { useCommonVuetifyConfig } from '@/plugins/commonVuetifyConfig'
import { i18n } from '@/plugins/i18n'
import type { CommonAdminGlobalComponents } from '@/shared/types/globalComponents'

// The admins feed these names to `vue/no-undef-components`; the types to templates. All three have to
// agree with what is actually registered.
describe('globalComponentNames', () => {
  it('names the Vuetify aliases and the components the plugin registers', () => {
    const app = createApp({}).use(AnzuSystemsCommonAdmin, { i18n, languages: { available: ['sk'], default: 'sk' } })
    const registered = [
      ...Object.keys(useCommonVuetifyConfig().commonAliases()),
      ...Object.keys(app._context.components),
    ]
    expect([...globalComponentNames].sort()).toEqual(registered.sort())
  })

  it('matches the global component types', () => {
    expectTypeOf<(typeof globalComponentNames)[number]>().toEqualTypeOf<keyof CommonAdminGlobalComponents>()
  })
})

// Used without an import, `AChipNoLink` has to be the library's chip (label, small, the grey underlay of
// `.a-chip-no-link`), not a plain `VChip` that looks different and reports nothing.
describe('AChipNoLink without an import', () => {
  it('is the library component', async () => {
    const el = document.createElement('div')
    const app = createApp({ setup: () => () => h(resolveComponent('AChipNoLink') as never, null, () => 'x') })
      .use(createVuetify({ aliases: useCommonVuetifyConfig().commonAliases() }))
      .use(AnzuSystemsCommonAdmin, { i18n, languages: { available: ['sk'], default: 'sk' } })
    app.mount(el)
    await nextTick()

    expect(el.querySelector('.v-chip')?.classList.contains('a-chip-no-link')).toBe(true)
    app.unmount()
  })
})
