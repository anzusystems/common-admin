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

Enables `anzu/no-ts-extension`, `anzu/prefer-api-command`, `anzu/prefer-api-fetch-items` and `anzu/url-params-match-template` as errors; each option takes `'warn'` or `'off'`, e.g. `anzuRecommended({ preferApiFetchItems: 'warn' })`. For oxlint: `"jsPlugins": ["@anzusystems/common-admin/oxlint"]` (alpha).

### Sentry and source maps

```ts
// vite.config.mts
import { anzuSentry } from '@anzusystems/common-admin/vite'

export default defineConfig({
  plugins: [...anzuSentry({ project: 'anzu-admin-cms' }), vue() /* ... */],
})
```

Sentry is on when `APP_DEPLOY_ENV` and `SENTRY_URL` are set; it needs `SENTRY_AUTH_TOKEN` and takes the release name from `GITVAR_SHORTVERSION`. The build then emits `hidden` source maps, uploads them to the `petitpress` org (`org` option) and deletes them from `build.outDir`, so they never reach the deployed site. A missing token or a failed upload fails the build; to build without Sentry, leave `SENTRY_URL` unset. The library's own source maps are chained into the admin's, so frames from common-admin resolve to its `.vue` and `.ts` sources. Other options go to `sentryVitePlugin`, e.g. `release: { name: 'verify-1', finalize: false }` for a test upload. Install `@sentry/vite-plugin` as a devDependency; keep `anzuSentry` first in `plugins`.

### Imports

Import what a module uses, helpers and types included (`import { isDefined, useAlerts } from '@anzusystems/common-admin'`, `import type { IntegerId } from '@anzusystems/common-admin'`); the admins do not auto-import. Only `Acl` and the `ABtn*` aliases are global components. oxfmt sorts the import statements (`sortImports`) and oxlint the names inside the braces; `scripts/codemods/explicit-imports` holds the scripts that moved the admins off `unplugin-auto-import` and sorted their imports.

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
