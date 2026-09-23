# Installation

```sh
yarn add @anzusystems/common-admin
```

Peer dependencies: `vue`, `vuetify`, `vue-i18n`, `pinia`, `vue-router`, `axios`, `dayjs`, `@vueuse/core`, `@vueuse/integrations` (with `sortablejs` for its `useSortable`), `@vuelidate/core`, `@vuelidate/validators`, `@sentry/vue`. Versions are in `peerDependencies` of [`package.json`](../../package.json). Icons are `mdi-*` classes: install `@mdi/font`.

## Configuration

```ts
import App from '@/App.vue'
import { vuetify } from '@/plugins/vuetify'
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, i18n } from '@/plugins/i18n'
import { router } from '@/router'
import { loadEnvConfig } from '@/shared/EnvConfigService'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  AnzuSystemsCommonAdmin,
  loadCommonFonts,
  type PluginOptions,
} from '@anzusystems/common-admin'
import '@anzusystems/common-admin/styles'

loadCommonFonts()

loadEnvConfig(() => {
  const app = createApp(App)
    .use(i18n)
    .use(createPinia())
    .use(vuetify)
    .use(router)
    .use<PluginOptions>(AnzuSystemsCommonAdmin, {
      languages: {
        available: AVAILABLE_LANGUAGES,
        default: DEFAULT_LANGUAGE,
      },
    })
    // additional plugin config
  app.mount('#app')
})
```

An admin i18n instance is required: common-admin components call `useI18n()`, which throws without one. Set it up as in [i18n](i18n.md#for-developer).

### Plugin options

- `languages` is required
- `coreDam` and `image` are needed only by the DAM and image components (asset select and upload, image widgets). Their `configs` are keyed by the components' `configName` prop, `default` unless set; a component used without its config throws `Composable can't be used without properly configured common admin.`
- `collab` is off unless set (`enabled`, `socketUrl`, `beforeReconnect`, `io`). Pass `io` from `socket.io-client`: only an admin with collaboration installs the package

```ts
import { io } from 'socket.io-client'

const collab: CommonAdminCollabOptions = {
  enabled: envConfig.collab.enabled,
  socketUrl: envConfig.collab.socketUrl,
  beforeReconnect: () => Promise.resolve(), // e.g. refresh an expired token first
  io,
}
```

### Vuetify

`vuetify` is created with `createVuetify()` using `aliases`, `defaults` and `theme` from `useCommonVuetifyConfig()`; `ABtnPrimary`, `ABtnSecondary`, `ABtnTertiary` and `ABtnIcon` exist only as these aliases. The locale adapter gets common-admin's `i18n`, vuetify reads its `$vuetify` texts from there:

```ts
// src/plugins/vuetify.ts
import { i18n, useCommonVuetifyConfig, useI18n } from '@anzusystems/common-admin'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'
import 'vuetify/styles'

const { commonTheme, commonAliases, commonDefaults } = useCommonVuetifyConfig()

export const vuetify = createVuetify({
  aliases: commonAliases(),
  locale: {
    // @ts-ignore
    adapter: createVueI18nAdapter({ i18n, useI18n }),
  },
  theme: commonTheme(),
  defaults: commonDefaults(),
})
```

### Global components

The plugin registers `Acl` globally; declare it for type checking (the `ABtn*` aliases are declared by the package):

```ts
// src/plugins.d.ts
declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    Acl: (typeof import('@anzusystems/common-admin'))['Acl']
  }
}
```

`useAlerts()` notifications show only where `<AAlerts />` is mounted: put it in every layout.

### ESLint

```js
// eslint.config.mjs
import { recommended as anzuRecommended } from '@anzusystems/common-admin/eslint'

export default defineConfigWithVueTs(
  // ...
  anzuRecommended(),
)
```

Enables `anzu/no-ts-extension`, `anzu/no-fatal-error-axios-check`, `anzu/prefer-api-command`, `anzu/prefer-api-fetch-items` and `anzu/url-params-match-template` as errors; each option takes `'warn'` or `'off'`, e.g. `anzuRecommended({ preferApiFetchItems: 'warn' })`. For oxlint: `"jsPlugins": ["@anzusystems/common-admin/oxlint"]` (alpha).

### Auto-imports

Admins auto-import the most used helpers and types (`isDefined`, `cloneDeep`, `useAlerts`, `useValidate`, `defineCached`, `IntegerId`, ...) with `unplugin-auto-import`. The list is in `autoImports.config.mts`, shared by `vite.config.mts` and `vitest.config.mts`; copy it from an existing admin. Components are not auto-imported: import them from `@anzusystems/common-admin` (only `Acl` and the `ABtn*` aliases are global).

## Component usage example

Then you can import and use any component, for example:

```vue
<script lang="ts" setup>
import { AThemeSelect } from '@anzusystems/common-admin'
</script>

<template>
  <AThemeSelect />
</template>
```
