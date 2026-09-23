# i18n

## For product owner/translators
- you can find translations in `src/locales/[lang]` in common-admin and all admins too
- if you need a new language to use in admin, you must also add this language to common admin if needed

## For developer
- admin creates its own vue-i18n instance (`createI18n` in `@/plugins/i18n`, with `slovakPluralizationRule` from common-admin)
- common-admin exports its own `i18n` instance too, it's used outside of components (alerts, validators, vuetify locale adapter), so loaded messages are also copied into it
- language translations are lazy loaded on app load

::: details Example - loading translation texts by using vue-router on first load
```ts
import { i18n as commonAdminI18n, type LanguageCode, modifyLanguageSettings } from '@anzusystems/common-admin'
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, i18n } from '@/plugins/i18n'
import { ref } from 'vue'

export const initLanguageMessagesLoaded = ref(false)

const { initializeLanguage, addMessages, currentLanguageCode } = modifyLanguageSettings(
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  i18n
)

export const initLoadLanguageMessages = async () => {
  const loadMessages = async (code: LanguageCode | 'default') => {
    if (code === 'default' || code === 'xx') return true
    try {
      const messages = await import(`./locales/${code}.ts`)
      addMessages(code, messages.default)
      commonAdminI18n.global.setLocaleMessage(code, messages.default)
      commonAdminI18n.global.locale.value = code
      initLanguageMessagesLoaded.value = true
      return true
    } catch (e) {
      console.error('Unable to load language translation messages.', e)
      return false
    }
  }
  initializeLanguage()
  await loadMessages(currentLanguageCode.value)
}
```
```ts
vueRouter.beforeEach(async () => {
  if (!initLanguageMessagesLoaded.value) await initLoadLanguageMessages()
})
```
:::

::: details Example - switching language
`ALanguageSelect` stores the selected language, emits `afterChange` and the admin reloads, so messages are loaded on app load again:
```vue
<script lang="ts" setup>
import { ALanguageSelect } from '@anzusystems/common-admin'

const afterLanguageChange = () => {
  window.location.reload()
}
</script>

<template>
  <ALanguageSelect
    :is-administrator="isSuperAdmin"
    @after-change="afterLanguageChange"
  />
</template>
```
:::

- common admin must contain translation for all languages used in admins
- language `xx` is used as system language for development purposes to display translation keys for admin user
- translations are merged to this object:

```ts
export default {
  common: {
    component1,
    component2,
    entity1,
    entity2,
    // and more
  },
  $vuetify: vuetify,
  error: {
    apiValidation: {
      ...apiValidation,
    },
    apiForbiddenOperation: {
      ...apiForbiddenOperation,
    },
    apiDependencyExists: {
      ...apiDependencyExists,
    },
    jsValidation: {
      ...jsValidation,
    },
    apiTimedOut: {
      ...apiTimedOut,
    },
  },
}
```

#### error
- errors consist of `apiValidation`, `apiForbiddenOperation`, `apiDependencyExists`, `jsValidation` and `apiTimedOut`
- `apiValidation`: anzu API can return validation error response with specific format containing keys that needs to be translated for user
- `apiForbiddenOperation`: same as above but for forbidden error response
- `apiDependencyExists`: message for dependency exists error response
- `jsValidation`: custom validation texts used by vuelidate and js validation inside vue app
- `apiTimedOut`: message for timed out API request

#### $vuetify
- custom modified translations for vuetify components

#### common
- all translations used by common admin components or really commonly reused translation are all prefixed by `common.xxx...`
::: warning
Do not add new root object keys to translations, put all new translation in `common` key so its clear it's for common admin. If you really need it, consult it with team and update docs.
:::

  
- translation texts are then exported for each language, so you can import only needed languages in admin
- in admin, you need to merge some translation, so it will contain messages used by common admin and admin messages, example:
```ts
import { messagesSk } from '@anzusystems/common-admin'

export default {
  common: messagesSk.common,
  $vuetify: messagesSk.$vuetify,
  cms: {
    site,
    job,
    article,
    rubric,
    // and more
  },
  sidebar,
  breadcrumb,
  system,
  error: {
    ...messagesSk.error,
    apiValidation: {
      ...messagesSk.error.apiValidation,
      ...apiValidation,
    },
    apiForbiddenOperation: {
      ...messagesSk.error.apiForbiddenOperation,
      ...apiForbiddenOperation,
    },
    jsValidation: {
      ...messagesSk.error.jsValidation,
      ...jsValidation,
    },
  },
}
```

### Anzu api entities
As anzu api work with specific response formats, in admins follow these rules:
- always put translation to system key:
```ts
cms: {
  site,
  job,
  article,
  rubric
  // and more
}
weather: {
  location,
  locationGroup  
  // etc
}
```
- inside of translation, always put entity fields inside of `model` key and filters inside of `filter` key, because validation errors are translated using this structure, example:
```json
{
  "filter": {
    "id": "Id",
    "title": "Title"
  },
  "model": {
    "id": "Id",
    "title": "Title",
    "domain": "Domain"
  }
}
```
- other fields are mostly up to you, but try to check and follow existing translations in admins


### More examples
- for better example check any admin with implemented common admin
