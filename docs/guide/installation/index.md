# Installation

Usage of stable version of common-admin

## Installation

::: code-group

```sh [yarn]
$ yarn add @anzusystems/common-admin
```

```sh [npm]
$ npm install @anzusystems/common-admin
```

:::

Peer dependencies: `vue`, `vuetify`, `vue-i18n`, `pinia`, `@vuelidate/core`, `@vuelidate/validators`, `unplugin`; optional: `vue-router`, `axios`, `dayjs`, `@vueuse/core`, `@vueuse/integrations`, `socket.io-client`, `@sentry/vue`. Versions are in `peerDependencies` of `package.json`.

## Configuration

```ts
import App from '@/App.vue'
import { vuetify } from '@/plugins/vuetify'
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, i18n } from '@/plugins/i18n'
import { router } from '@/router'
import { loadEnvConfig } from '@/services/EnvConfigService'
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
    .use<PluginOptions>(AnzuSystemsCommonAdmin, { // [!code hl]
      languages: { // [!code hl]
        available: AVAILABLE_LANGUAGES, // [!code hl]
        default: DEFAULT_LANGUAGE, // [!code hl]
      }, // [!code hl]
    }) // [!code hl]
    // additional plugin config
  app.mount('#app')
})
```

`vuetify` is created with `createVuetify()` using `aliases`, `defaults` and `theme` from `useCommonVuetifyConfig()`; `ABtnPrimary`, `ABtnSecondary`, `ABtnTertiary` and `ABtnIcon` exist only as these aliases.

When you need to use `i18n` or you use components with localized texts, you need to also setup [i18n](../i18n/#for-developer)

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

Check [documentation](../../api/) for components and features.
