# Usage in project

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

## Configuration

```ts
import App from '@/App.vue'
import { vuetify } from '@/plugins/vuetify'
import { router } from '@/router'
import { loadEnvConfig } from '@/services/EnvConfigService'
import { createApp } from 'vue'
import {
  AnzuSystemsCommonAdmin,
  i18n,
  type LanguageCode,
  loadCommonFonts,
  type PluginOptions,
} from '@anzusystems/common-admin'
import { useCurrentUser } from '@/composables/system/currentUser'
import type { AclValue } from '@/types/Permission'
import '@anzusystems/common-admin/styles'

export const DEFAULT_LANGUAGE: LanguageCode = 'sk'
export const AVAILABLE_LANGUAGES: Array<LanguageCode> = ['en', 'sk']

const { currentUser } = useCurrentUser()

loadCommonFonts()

loadEnvConfig(() => {
  const app = createApp(App)
    .use(i18n)
    .use(vuetify)
    .use(router)
    .use<PluginOptions<AclValue>>(AnzuSystemsCommonAdmin, { // [!code  hl]
      currentUser, // [!code  hl]
      languages: { // [!code  hl]
        available: AVAILABLE_LANGUAGES, // [!code  hl]
        default: DEFAULT_LANGUAGE, // [!code  hl]
      }, // [!code  hl]
    }) // [!code  hl]
    // additional plugin config
  app.mount('#app')
})
```

## Component usage example

Then you can import and use any component, for example:
```vue
<script lang="ts" setup>
import { AThemeSelect } from '@anzusystems/common-admin'
</script>

<template>
  <AThemeSelect />
<template>
```

Check documentation for list of all components and features.
