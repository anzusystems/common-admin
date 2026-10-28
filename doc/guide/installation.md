# Installation

```sh
yarn add @anzusystems/common-admin
```

Peer dependencies: `vue`, `vuetify`, `vue-i18n`, `pinia`, `vue-router`, `axios`, `dayjs`, `@vueuse/core`, `@vueuse/integrations` (with `sortablejs` for its `useSortable`), `@vuelidate/core`, `@vuelidate/validators`, `@sentry/vue`. Optional: `socket.io-client` (collaboration), `vite` and `@sentry/vite-plugin` (the `./vite` entry), `@vueuse/shared` (comes with `@vueuse/core`; the declarations name its types). Versions are in `peerDependencies` of [`package.json`](../../package.json). Icons are `mdi-*` classes: install `@mdi/font`.

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
      i18n,
      languages: {
        available: AVAILABLE_LANGUAGES,
        default: DEFAULT_LANGUAGE,
      },
    })
    // additional plugin config
  app.mount('#app')
})
```

The admin's i18n instance is required, in composition mode (`legacy: false`): common-admin translates through it -- its components with `useI18n()`, its validators and alerts through the `i18n` plugin option. Set it up as in [i18n](i18n.md#for-developer).

The library's stylesheet is one cascade layer, `anzu-common`. Name it in the admin's `@layer` statement in `index.html`, before any stylesheet, between Vuetify's overrides and utilities -- a layer the statement does not name lands after `vuetify-final`, above the utility classes. Vuetify's sub-layers follow in the same `<style>`, in the order its `main.css` declares them: its component stylesheets name them too, and whichever loads first would otherwise decide (a cms build had `trumps` below `transitions`):

```html
<style>
  @layer vuetify-core, vuetify-components, vuetify-overrides, anzu-common, vuetify-utilities, vuetify-final;
  @layer vuetify-core.reset, vuetify-core.base;
  @layer vuetify-utilities.theme-base, vuetify-utilities.typography, vuetify-utilities.helpers, vuetify-utilities.theme-background, vuetify-utilities.theme-foreground;
  @layer vuetify-final.transitions, vuetify-final.trumps;
</style>
```

### Plugin options

- `i18n` (the admin's vue-i18n instance) and `languages` are required
- `coreDam` and `image` are needed only by the DAM and image components (asset select and upload, image widgets). Their `configs` are keyed by name; a component used without its config throws `Composable can't be used without properly configured common admin.`
  - Each configuration is a DAM of its own: every state of a DAM is kept per name, and two configurations of two DAMs on one page share none of it but the user of the licence check (the current user of `dam` for every configuration that names no `currentUser`). A configuration holds its `damClient`; its addresses `endPointAsset`, `endPointImage`, `endPointRoi`, `endPointAuthor`, `endPointKeyword`, `endPointConfiguration`, `endPointPubConfiguration`, `endPointAssetLicence`, `endPointAssetCustomForm`, `endPointUser`, `endPointPodcast` and `endPointCmsAsset`, each its `/adm/v1/…` address (`/pub/v1/configuration`) where left out; its DAM configuration (settings with the chunk bounds, the ext system of a licence, the rules and custom forms of an ext system) in `useDamConfigStoreOf(name)`, loaded with its client, and the last chunk size beside it; its caches of the names of authors, keywords and users, asked with its client at its addresses, and the ext system they ask under (within one name, the one written last); its `notification`; `currentUser`; `adminDomain` and `apiTimeout`, the root ones where left out (`apiTimeout` is to be the timeout of its `damClient`, which the library does not set: it sizes the chunks of its uploads and the waits of its widgets by it).
  - A component works under its own `configName` prop when given, else under that of the nearest ancestor that has one, else under `default`; the name is read once, in setup. A widget, an asset select or an asset detail given a name therefore takes what it opens with it: the upload and its dialogs, the saves, the author and keyword inputs. The name is handed down by provide/inject under an internal key (`DamConfigNameKey`, not exported), so a part of a page is put under a configuration by giving `configName` to the library component at its root. A wrapper of the admin's that declares `configName` with a default of `'default'` passes that on, and a name given wins over an inherited one. `useDamConfigState`, `useDamKeywordAssetTypeConfig`, `useDamAuthorAssetTypeConfig`, `useDamDistributionServiceType`, `useDamUploadChunkSize`, `useDamCachedAuthors`, `useDamCachedKeywords`, `useDamCachedUsers` and `useExtSystemIdForCached` left without a name take that of the nearest ancestor that has one while a component sets up, renders or runs a lifecycle hook, else `default`; `useDamConfigStoreOf()`, `useDamNotificationsConnection()`, `useCommonAdminImageOptions()`, `useDamUpload()` without a preset and `addDamNotificationListener(callback)` without options are `default`'s whatever calls them. Once the plugin has set `coreDam`, a name not in `coreDam.configs` throws: in a component at setup, in `useDamConfigState(client, name)` and in the caches of names. `default` is not checked there: with a `coreDam.configs` that has no `default`, its caches leave the names they are asked for unresolved (their request throws), and `useDamConfigState(client)` loads with the client it is given at the default addresses; a component under `default` throws at setup.
  - An upload queue keeps the name its rows were added under, and refuses rows under another name while it has rows. Its rows are settled, refreshed and written back from a detail only through that configuration, so two DAMs may give one asset id.
  - DAM notifications: `notification` of a configuration (`{ enabled, webSocketUrl }`, as the root one); `default` without it has the root one, another configuration none, and its uploads are polled for without the service. `initDamNotifications()` makes a socket for each distinct service, shared by the configurations that name it, and `openConnection()` of its handle opens them all. An event concerns the queues of the configurations of its socket; `addDamNotificationListener(callback, { configName } | { all: true })` hears another socket than `default`'s, and the callback gets the configurations of the socket as its second argument.
  - An application with a named configuration gives: the same name in `image.configs` (`AImagePublicInput` reads both under its name and throws at setup when the name is not in `coreDam.configs`); a DAM configuration and licences its client can read, or `useDamConfigStoreOf(name)` filled before its components mount (the widgets show their error state otherwise); its user loaded under `currentUser` (`dam` by default, `false` for every licence), a user of DAM (`DamCurrentUserDto`): a user of another system allows no licence; its `notification`, or its uploads are polled for without a socket; the ext system written with `useExtSystemIdForCached(name)` where it shows names of the configuration outside its image widgets and asset selects (`ADamAuthorCachedChip`, `useDamCachedAuthors(name)`).
  - What stays one for the page whatever the names: the asset select with its filter, pagination and side panels, the open asset detail, the gallery of images, the media widget, the region editor and the upload dialog; two pickers, galleries or details open at once clash. Two configurations that name one notification address are taken for one DAM: equal asset ids under them are not told apart for a failure or a duplicate it tells of. `AImageMediaWidget` has no `skipCurrentUserCheck` (the owner's choice): `currentUser: false` offers every licence. What takes only a client keeps the fixed addresses: `ADamAssetLicenceRemoteAutocomplete`, `ADamAssetLicenceGroupRemoteAutocomplete`, `ADamExtSystemRemoteAutocomplete`, `ADamUserRemoteAutocomplete` given a `client` (at `/adm/v1/user`), `fetchDamUser`, `updateDamUser`, `fetchDamAssetLicenceListByIds`, `useFetchDamAssetLicenceList`, `fetchDamAssetLicenceGroupListByIds`, `fetchDamExtSystemListByIds`, and `fetchDamUserListByIds`, `useFetchDamUserList` and `fetchAssetAsCmsMedia` called without an address.
  - `copyToLicenceEnabled: false` takes away the copy of a picked asset into the licence a widget uploads into: the asset select's switch and the widgets' request, a `PATCH` to `endPointImage` + `/copy-to-licence`. Left out it is on. An application whose upload licence is the only one it picks from has no use for the copy and is to turn it off; admin-ugc is to set it with this release and has not yet.
  - `keywordCreateAcl` and `authorCreateAcl` are the grants the creation of a keyword and of an author needs, checked before it is offered; none when left out (admin-dam sets `dam_keyword_create` and `dam_author_create`).
  - `image.configs[name].imageApi`: `createImage`, `updateImage` and `bulkUpdateImages` are handed the fields of the image only (`texts`, `flags`, `dam`, and `position` and `id` when the image has them), not the object a read returned. After `createImage` a widget shows its answer and does not call `fetchImage`.
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

`vuetify` is `createAnzuVuetify({ i18n })`: `createVuetify()` with the `aliases`, `defaults` and `theme` from `useCommonVuetifyConfig()`, the `Intersect` directive, and the locale adapter over the admin's `i18n`, where vuetify reads its `$vuetify` texts. `ABtnPrimary`, `ABtnSecondary`, `ABtnTertiary` and `ABtnIcon` exist only as these aliases. `defaults` is merged over the common ones per component. The stylesheets stay imported by the admin, in this order:

```ts
// src/plugins/vuetify.ts
import { createAnzuVuetify } from '@anzusystems/common-admin'

import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { i18n } from '@/plugins/i18n'

export const vuetify = createAnzuVuetify({ i18n })
// admin-ugc: createAnzuVuetify({ i18n, defaults: { VDataTableServer: { mobileBreakpoint: 'md', disableSort: true } } })
```

### Global components

The plugin registers `Acl` and `AChipNoLink` globally; they and the `ABtn*` aliases are declared by the package. Register the admin's ACL values once, so `<Acl :permission>` checks them:

```ts
// src/plugins.d.ts
import type { AclValue } from '@/domains/system/auth/auth'

declare module '@anzusystems/common-admin' {
  interface AclRegistry {
    acl: AclValue
  }
}
```

`useAlerts()` notifications show only where `<AAlerts />` is mounted: mount it once, outside the layout switch (e.g. next to `<component :is="layout">` in `AppLayout.vue`). A host inside a layout takes the alerts it shows away with it when the route switches layouts; alerts raised before a host mounts wait for it.

### ESLint and oxlint

The admins' whole eslint config is the library's:

```js
// eslint.config.mjs
import { defineAnzuAdminConfig } from '@anzusystems/common-admin/eslint'

export default defineAnzuAdminConfig({ root: import.meta.url })
```

`root` is what everything resolves against: the eslint plugins (from the admin's own `node_modules`, which declares them: `@vue/eslint-config-typescript`, `eslint-plugin-vue`, `eslint-plugin-pinia`, `eslint-plugin-vuetify`, `eslint-plugin-oxlint`), Vuetify's component list, `.oxlintrc.json` and `src/typed-router.d.ts`. Options: `noExplicitAny` (`'error'`), `globalComponents` (more globally registered components for `vue/no-undef-components`), `ignores`, `oxlintConfig`, `typedRouter`, `anzu` (severities of the anzu rules), `vueProject` (`configureVueProject()` of `@vue/eslint-config-typescript`; `rootDir` defaults to the admin's directory); configs passed after the options come last. The plugins are optional peer dependencies of the library. It enables `anzu/no-ts-extension`, `anzu/prefer-api-command`, `anzu/prefer-api-fetch-items`, `anzu/url-params-match-template` and `anzu/valid-route-name` (route names checked against `src/typed-router.d.ts`).

The shared oxlint rules:

```json
// .oxlintrc.json
{
  "extends": ["./node_modules/@anzusystems/common-admin/src/eslint/oxlint-admin.json"],
  "env": { "browser": true },
  "ignorePatterns": ["dist", "e2e", "src/typed-router.d.ts"],
  "categories": { "correctness": "error" }
}
```

`extends` takes over rules, plugins and overrides, so env, categories and ignorePatterns stay in the admin. (`oxlint --print-config` shows the extended rules without their options; they apply all the same.) Without the preset: `recommended()` and `globalComponentNames` from the same entry; for oxlint's JS plugins `"jsPlugins": ["@anzusystems/common-admin/oxlint"]` (alpha).

### Start-up

```ts
// src/shared/EnvConfigService.ts
export const loadEnvConfig = (callback: () => void | Promise<void>) => startWithEnvConfig(setEnvConfig, callback)
```

`startWithEnvConfig(apply, start)` fetches `/config.json` past any cache (`url` option for another path), checks the response and hands the config to `apply`, then runs `start`, the admin's start-up (`createApp`, plugins, `mount`). When either fails, `#app` shows the fatal error; a failed start also goes to `reportError`, so an error handler already installed (Sentry's) reports it.

### App shell

```vue
<!-- src/layouts/AppLayout.vue -->
<script lang="ts" setup>
import { ALayoutLoader, ALayoutSwitch } from '@anzusystems/common-admin'
import AppLayoutDrawer from '@/layouts/AppLayoutDrawer.vue'
import AppLayoutFullscreen from '@/layouts/AppLayoutFullscreen.vue'

const layouts = { AppLayoutLoader: ALayoutLoader, AppLayoutDrawer, AppLayoutFullscreen }
</script>

<template>
  <ALayoutSwitch :layouts="layouts">
    <slot />
  </ALayoutSwitch>
</template>
```

`ALayoutSwitch` renders the layout a page names in `definePage({ meta: { layout } })` (`defaultLayout`, `'AppLayoutLoader'`, until the first navigation and for a page that names none) and mounts the one `<AAlerts />` outside it. The drawer layout's app bar holds `<AActionbarTarget />`; a page renders its breadcrumbs and buttons into it with `<AActionbar :breadcrumbs>` and its `buttons` slot (`resolveBreadcrumbRoute` for breadcrumbs linked other than by route name). Another place of that kind is `createTeleportSlot(name)`, whose `Target` and `Source` are what these two use.

### Remote autocompletes

```vue
<!-- admin-cms src/domains/cms/advertSettings/components/AdvertSettingsRemoteAutocomplete.vue -->
<script lang="ts">
import { createRemoteAutocomplete } from '@anzusystems/common-admin'
import { useAdvertSettingsSelectActions } from '@/domains/cms/advertSettings/composables/advertSettingsSelectActions'
import { useAdvertSettingsInnerFilter } from '@/domains/cms/advertSettings/filter/AdvertSettingsFilter'

export default createRemoteAutocomplete({
  name: 'AdvertSettingsRemoteAutocomplete',
  useSelectActions: useAdvertSettingsSelectActions,
  useInnerFilter: useAdvertSettingsInnerFilter,
  filterByField: 'title',
  zeroIsEmpty: true,
  defaults: { clearable: true },
})
</script>
```

The component is `AFormRemoteAutocomplete` with the entity's select actions and inner filter (provided to it), the field it searches by and `defaults` for its props; `createFilterRemoteAutocomplete` does the same for `AFilterRemoteAutocomplete` in a list filter. Everything the caller passes — props, `v-model`, listeners, slots, attributes such as `data-cy` — reaches the autocomplete and wins over `defaults` (a value left `undefined` keeps the default). Write attributes in kebab-case: they are not props, so `dataCy` would stay `dataCy`. `zeroIsEmpty` reads a model value of `0` as nothing selected. The model is typed `T | T[] | null`; a caller that binds a value which may be `undefined` needs `createRemoteAutocomplete<IntegerId, IntegerId | IntegerId[] | null | undefined>`.

A list that depends on a parent (a site group, an ext system, a desk) takes the component's own `props`, `filterFromProps` and `scope`:

```vue
<!-- admin-cms: siteGroupScoped() in src/domains/cms/shared/composables/siteGroupScopedAutocomplete.ts -->
<script lang="ts">
export default createRemoteAutocomplete({
  name: 'PromoLockRemoteAutocomplete',
  props: { siteGroupId: { type: Number as PropType<IntegerIdNullable>, default: null }, siteGroupRequired: Boolean },
  useSelectActions: () => usePromoLockSelectActions(),
  useInnerFilter: usePromoLockInnerFilter,
  filterFromProps: (props) => ({ siteGroup: props.siteGroupId || null }),
  scope: { of: (props) => props.siteGroupId || undefined, requiredWhen: (props) => props.siteGroupRequired },
  filterByField: 'title',
})
</script>
```

- `props` are the component's own: declared (so reactive, and booleans cast), not passed to the autocomplete. `useSelectActions` is then called with them -- wrap an admin composable that takes an optional argument (`() => useX()`), or it receives the props object.
- `filterFromProps` writes the inner filter fields in setup, before the autocomplete's first fetch, and again on every change. It writes every key it returns each time, so return `null` for an unset one.
- `scope.of` is what the list depends on, `undefined` while unset. It keys the inner autocomplete, which keeps its fetched list across a model reset and prefetches once, so a changed scope remounts it with a fresh list. When the scope changes from a set value the model is cleared (`[]` for a `multiple` field, else `null`) unless `reset: false`, for a caller that clears it itself; not at mount. `requiredWhen` disables the field while the scope is unset, whatever the caller passes; otherwise the caller's `disabled` goes through, or its absence, which leaves the collab lock to decide. A filter (`createFilterRemoteAutocomplete`) is keyed the same way and never resets.
- A single-valued model with `props` needs the props type as well: `const props = { ... } as const` and `createRemoteAutocomplete<DocId, DocIdNullable, typeof props>({ props, ... })`.

### Api clients

```ts
// src/shared/apiClients/blogClient.ts
import { defineApiClient } from '@anzusystems/common-admin'

export const blogClient = defineApiClient(() => ({
  config: {
    baseURL: envConfig.blog.apiUrl,
    timeout: envConfig.blog.apiTimeout * 1000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json', 'X-App-Version': 'adminBlog-' + envConfig.appVersion },
  },
  // both from `createRefreshRequestInterceptor({ …, skipUrlPrefix: AUTH_PATH_PREFIX })`
  request: [{ onFulfilled: userRefreshRequestInterceptor, options: userRefreshRequestInterceptorOptions }],
  response: [{ onRejected: logoutUserResponseInterceptor }],
}))
```

The setup runs on the first `blogClient()`, not when the module loads: the env config is empty until it has loaded, and the refresh interceptor, which calls the auth api through this client, is in an import cycle with it. That call creates the instance and registers each interceptor once; later calls return the same instance. `config` goes to `axios.create` as it is, with no defaults added. `skipUrlPrefixes(...prefixes)` builds a `runWhen` for another interceptor, or for more prefixes than the refresh interceptor's one.

### Guard tests

```ts
// src/test/closeButton.test.ts
import { describeCloseButtons } from '@anzusystems/common-admin/testing'

import { routeHistoryBlacklist } from '@/router/routeHistory'
import declaration from '@/typed-router.d.ts?raw'

describeCloseButtons({
  sources: import.meta.glob<string>('/src/**/*.vue', { query: '?raw', import: 'default', eager: true }),
  declaration,
  routeHistoryBlacklist,
})
```

`@anzusystems/common-admin/testing` holds the tests every admin needs over its own sources and routes: `describeGeneratedRoutes` (every generated route resolves to its own record), `describeCloseButtons` (the route names in the close buttons), `describeRouteHistory` (the admin's blacklist with the library's history), `describeSortableLists` (no hand-rolled sortable list; `unsavedRegistration` checks that each list editor registers with the unsaved changes guard -- `:unsaved-section-label`, or bare `disable-unsaved` / `readonly`; an editor handed a lifted controller (`:editor`) is left to the one that owns it), `describeAlertHost` (one alerts host, in `AppLayout.vue`: `<ALayoutSwitch>`, or an `<AAlerts />` before the admin's own layout switch), `describeCssLayerOrder` (the `@layer` statements in index.html, `CSS_LAYER_STATEMENTS`, and that they open the first style in the page: layers are ordered by first mention) and `describeDeclaredDependencies` (every package the sources import is in `package.json` rather than only brought by another dependency: `sources` over `/src/**/*.{vue,ts,mts,scss}`, `packageJson` from `import.meta.glob('/package.json', { import: 'default', eager: true })`). The globs stay in the admin, because Vite resolves them there. Test code only: it imports vitest (an optional peer), and the main entry never imports it.

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
