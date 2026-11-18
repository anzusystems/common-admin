# D — Presun z adminov do knižnice (detail)

Skopírovaná kostra appky má ~10 tis. riadkov, plus ~10 tis. lokálnych kópií permission/anzuUser. Všetko aditívne (2.x), okrem D5 (dá sa dnes) a D7 (s C1). Podklady: `batch2/design-auth-out/`, `batch2/design-shell-out/`.

---

## D1 — Auth pipeline · REPRO
- **Kde:** v každom admine `router/beforeEachRoute.ts`, `checkAbility.ts`, `appInitialize.ts`, `routeHistory.ts`, `checkNewVersion.ts`, `appReload.ts` (identický ×6), `authCookies.ts`, `responseLogoutUser.ts`, `authApi.ts:useRefreshToken`.
- **Refresh interceptor je chybný v 5 z 6 adminov** (spustené so skutočnými interceptormi, axios 1.20, falošný backend s rotáciou):
  - 400 z druhého tabu → **logout** (blog, forum, ugc, cms, dam; inhouse OK)
  - 5xx/timeout/sieť → **logout** (rovnaké; inhouse `AuthUnavailableError`)
  - request po refreshi bez cookie → **visí navždy** (blog, forum, ugc, cms; dam, inhouse OK)
  - Príčina: príznak refreshu sa nuluje v `.finally` až po flushnutí fronty. Správny je inhouse `refreshSession.ts:37-90` (single-flight, porovnanie JWT cookie).
- **Návrh API (aditívne):** `installAppGuard`, `createAppStartup`, `createSessionGuard`, `checkRouteAbility`, `consumeLoginState`, `createAuthCookies` (`isJwtExpired`), `createAnzuSession` (Web Locks naprieč tabmi), `requestAppReload`. Podpisy `design-auth-out/03-library-api.ts`.
- **Úspora:** ~2,95 tis. riadkov produkcie + 1,2 tis. testov; knižnica +600 kód, +700 testy.
- **Admin bugy nezávisle od knižnice:** blog/forum `fetchCurrentUser` bez `throwOnError` (`appInitialize.ts:22`) → po zlyhaní zaseknuté na `/unauthorized`, chýba `/error` stránka; bootstrap chyba nejde do Sentry (callback v `.then().catch(onConfigError)`); prvá navigácia s chybou = nekonečný loader (`@sentry/vue` `router.onError` registruje, ale na START_LOCATION ostane prázdny render). cms `atob` na base64url JWT je latentné (0/343200 reálnych payloadov).

## D2 — App shell · ČÍTANIE
- **Identické/takmer:** `layouts/AppLayout.vue` ×6, `ActionbarTeleportTarget.vue` + `composables/actionbar.ts` ×5, `AppLayoutLoader`/`Fullscreen` takmer, `ActionbarWrapper.vue` (94 r.) na ~770 stránkach, `AppLayoutDrawer.vue` sa líši logami/sidebarom.
- **Bug:** ugc `AppLayoutLoader.vue`/`AppLayoutFullscreen.vue` nemajú `<AAlerts/>` → alerty pri štarte a logine sa stratia (**opraviť v ugc dnes**, patch v quickwins). cms `ai/prompts/minimal/[id]` je vo Fullscreen bez actionbaru → breadcrumbs/Close sa nikdy nevykreslia (ROZHODNI: pridať target alebo zmazať mŕtvy breadcrumb).
- **Návrh:** `AActionbar`+`AActionbarTarget`, `AAppShellDrawer` (sloty logo/sidebar/append…), `ALayoutSwitch`/`ALayoutLoader`/`ALayoutFullscreen`; alerts host raz cez `ALayoutSwitch` + buffer v `alerts.ts`. `createTeleportSlot(name)` (vzor je 9×, aj v knižnici). Sketch `design-shell-out/sketch-1-app-shell.ts`.

## D3 — Bootstrap · ČÍTANIE
- **Kde:** `main.ts` 27-riadkový `Sentry.init` ×6, `EnvConfigService.ts` `loadEnvConfig` ~45 r. ×6, `plugins/vuetify.ts` 20 r. s `@ts-ignore` ×6 (zbytočný v 5 adminoch, v ugc skrýva reálny mismatch), `styles/main.scss` 63-riadkový `@layer` reset ×6.
- **Návrh:** `loadEnvConfig<T>`, `createAnzuI18n`, `createAnzuVuetify` (bez ts-ignore), `initAnzuSentry`, CSS v `@layer` (F5), augmentácie ako `@anzusystems/common-admin/augment`, nad tým `createAnzuAdmin(...)`. `main.ts` zo 66–137 na ~25 riadkov.

## D4 — Axios klienti · ČÍTANIE
- **Kde:** ~30 factory súborov (cms a inhouse po 11), všade lazy singleton, `X-App-Version`, `withCredentials`, refresh interceptor s `runWhen`, logout pri 401.
- **Návrh:** `defineApiClient({ baseURL, timeoutSec, appVersionHeader, auth, skipPrefixes })`.

## D5 — Filtre: mŕtvy `inject` + forwardy · REPRO
- **Kde:** 201 filtrov robí `inject(FilterConfigKey)`+`inject(FilterDataKey)`+`throw`, 193 hodnoty už nepoužije. `AFilterWrapper` to overuje sám (`labs/filters/AFilterWrapper.vue:57-61`) → **mŕtvy kód, zmazať v adminoch dnes**. 210 z 212 forwardov `@submit/@reset` má single root → nahradí fallthrough (bez `strictTemplates`). `AFilterWrapper` 215×, 104× `:client`+`:user-id`.
- **Overené:** codemod zmazal 195 súborov (len nepoužité bloky), vo všetkých adminoch prešli kontroly aj testy; fallthrough overený vue-tsc + runtime testom + ctx7 docs. Patche `batch3/quickwins/out/<admin>.patch` (+ `.fallthrough.patch`).
- **Návrh knižnice (aditívne):** `provideFilter`/`useInjectedFilter`, plugin option `filters:{client,currentUserId}`, prop `bookmarks?`.

## D6 — Remote autocomplete factory · ČÍTANIE
- **Kde:** 136 súborov / 8,5 tis. riadkov obaľuje `AFormRemoteAutocomplete`/`AFilterRemoteAutocomplete`. Klastre: 64 čistý boilerplate, 12 props do inner filtra, 19 scoped parentom, 12 custom, 6 permissionGroup kópie, 23 vnorené vo väčšom formulári.
- **Návrh:** `createRemoteAutocomplete({...})` pokryje 95 zo 136 (~3 tis. riadkov). `createCachedChip` self-fetch nahradí `LoadingCachedUserChip` a 47 ručných chipov. Sketch `design-shell-out/sketch-3-remote-autocomplete.ts`.

## D7 — eslint/vite presety · ČÍTANIE
- **Kde:** `valid-route-name.mjs` byte-identický ×6, `routerPages.config.mts` ×6, `eslint.config.mjs` rovnaký v 4, `.oxlintrc.json` v 5, `watchCommonAdmin`/chunk group v každom `vite.config.mts`.
- **Návrh:** `./eslint` → `defineAnzuAdminConfig()` (221→5 riadkov), statický `commonAliasNames`/`globalComponentNames` (odstráni regex, **nutné s C1**), `anzu/valid-route-name` do pluginu; `./vite` → `commonAdminDevWatch`, chunk group, `anzuRouterPages`.

## D8 — `./testing` entry · ČÍTANIE
- **Kde:** `listEditorUnsaved.test.ts` identický ×6, `closeButton.test.ts` (1131 r.), `routes`, `routeHistory`, `newVersionReload`, `sortable` (testuje zmazaný `ASortable`), `alertHost` — spolu ~4,2 tis. riadkov, väčšina existuje kvôli pasciam knižnice.
- **Návrh:** `createTestApp`, `describeGeneratedRoutes`, `describeCloseButtons`; každý duplikát sa zmaže, keď dosadne oprava za ním. Sketch `design-shell-out/sketch-5-testing.ts`.

## D9 — Chýbajúce exporty · ČÍTANIE
- `apiErrorStatus` (admini prepisujú na 26 miestach, ich verzia prehliadne `AnzuApiResponseCodeError.code`), `DamMediaType`/`DamMediaTypeType`, `SORT_BY_SCORE_DATE/BEST`, `CommonAdminImageOptions`/`CommonAdminCoreDamOptions`, generický `Permissions<TAcl>`, drobné typy. Spolu 122 deklarácií, na ktoré odkazujú exportované typy a samé sa neexportujú.

## D10 — Spoločné jadro upload queue · ČÍTANIE · TODO 2.x
- **Stav:** `damImage/uploadQueue/composables/uploadQueuesStore.ts` (knižnica, od Release 1.40.0, 2024-01) je upravená kópia admin-dam `src/domains/coreDam/asset/store/uploadQueuesStore.ts`. 22 z 26 funkcií knižnice má v dam rovnaký názov. Len v knižnici: `addByCopyToLicence`, `queueItemCopied`, `queueItemFullyProcessed`, `updateFromDetail`. Len v dam: sloty (`addByFilesAsSlotUpload`, `getQueueItemForSlotItem`), external provider, hromadné metadáta (`queueItemsReplaceEmpty*`), `fetchLazyAdditionalMetadata` a ďalšie.
- **Prečo má knižnica v praxi jednu queue:** UX widgetov — upload nebeží na pozadí, user počká, potvrdí a doplní popis. Robí to jeden globálny `uploadQueueDialog` a zatvorenie dialógu volá `stopUpload`. Jadro ostalo na viac queue (mapa podľa `queueKey`, počty, stop, clear a návrhy na queue). admin-dam beží s queue `global` a `slots` naraz.
- **Problém:** kópie sa rozchádzajú. admin-dam opravil limit paralelných uploadov a stop pri zrušení v `b825c77e` (2026-09-05) a prepísal upload service (`asset/api/fileApi.ts`); knižnica má pôvodný kód (A1, A5, A7). Každá oprava sa robí dvakrát.
- **Návrh:** jedno jadro v knižnici — store a upload service s viacerými queue, limitom paralelných uploadov, stopom, fallback pollingom a notifikáciami. admin-dam nad ním doplní sloty, external provider a hromadné metadáta, widgety režim jednej queue s potvrdením. Rozhodnúť, či limit na queue alebo globálny (dam dnes s `global` + `slots` až 4 uploady naraz).
- **Poradie:** najprv opravy A1, A5, A7 v knižnici (2.0.0), zjednotenie v 2.x.
- **Pripojené B2 (rozhodnutie 2026-09-26):** statický DAM config, read-only `useDamConfig()`, `AAssetList` a neexportované zapisovateľné stores (`useDamConfigStore`, `useImageStore`) sa riešia spolu so spoločným jadrom, nie v 2.0.0. Podklady B2: `batch2_breaking-out/b2-static-config-design.ts`, `b2-ugc-migration.diff`.
