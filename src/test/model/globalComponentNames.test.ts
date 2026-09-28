import { describe, expect, expectTypeOf, it } from 'vitest'
import { createApp } from 'vue'
import AnzuSystemsCommonAdmin from '@/AnzuSystemsCommonAdmin'
import { globalComponentNames } from '@/eslint/globalComponentNames.mjs'
import { useCommonVuetifyConfig } from '@/model/commonVuetifyConfig'
import { i18n } from '@/plugins/i18n'
import type { CommonAdminGlobalComponents } from '@/types/globalComponents'

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
