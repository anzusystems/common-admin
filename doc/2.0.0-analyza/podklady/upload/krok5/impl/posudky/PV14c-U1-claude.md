# PV14c-U1 (admin-ugc): adversarial review (Claude)

Tree `/home/volar/projects/petit/admin-ugc` (`next`, HEAD `7ca2b1d`, uncommitted), library = leader's copy in
`node_modules/@anzusystems/common-admin` (dist checked where it matters). Read whole: the three wrappers,
`ImageWidgetSimple.vue`, the new test, the changelog, the note, the brief, the plan, the logs and bend files, and on the
library side `damConfigStore.ts`, `damConfigState.ts`, `damConfigName.ts`, `commonAdminCoreDamOptions.ts`,
`AImageWidget.vue`, `AImageWidgetMultiple.vue`, `AAssetListInner.vue`, `AImageWidgetSimple.vue`,
`AssetDistributionServiceNameFilter.vue`, `damUploadChunkSize.ts`. No test, build or yarn run by me: results below are
from the logs.

Verdict: the change does what the brief asks. No High, no Medium. Two Low.

## Findings

### High
None.

### Medium
None.

### Low 1. An unknown `configName` gets a store before anything checks it; the library checks the name first

Where: `ImageWidget.vue:86-87`, `ImageWidgetMultiple.vue:61-62`, `AssetList.vue:50-51` call
`useDamConfigStoreOf(props.configName)` in setup. `useDamConfigStoreOf` does not check the name and defines and creates
`commonAdminDamConfigStore:<name>` for any name (`damConfigStore.ts:104-117`; dist
`dist/domains/dam/config/store/damConfigStore.js`, same logic). The note records this as a decision
(`impl/PV14c-U1.md:51-53`).

The library does it the other way round. L1-c1 point 6 (`impl/PV14c-L1.md:131-132`) put the check before the store,
with a case for it: `AssetDistributionServiceNameFilter.vue:27-29` ("The name first: a configuration the application
has not got throws here, and gets no store"). `AImageWidget.vue:81,88` and `AImageWidgetMultiple.vue:55,62` throw on
`useCommonAdminCoreDamOptions` before they touch the store. `useDamConfigState` checks before it takes the store
(`damConfigState.ts:34-36`, `checkDamConfigName` at `damConfigName.ts:37-40`). The docs say "a name not in
`coreDam.configs` throws: in a component at setup" (`doc/guide/installation.md:64`, `doc/changelog/2.0.0.md:76`). Not
every library path checks: `useDamConfigStoreOf` itself, and the public `useDamDistributionServiceType` and
`useDamUploadChunkSize` (`DamDistributionServiceType.ts:11`, `damUploadChunkSize.ts:14-15`), also make a store for any
name. So the note's sentence "v knižnici neznáme meno obchod nedostane" is true for the components and
`useDamConfigState`, not for the whole library.

Failure scenario: a page passes `config-name="ugc"` (a typo, or a name that was never added to `coreDam.configs`). The
wrapper's setup creates and registers `commonAdminDamConfigStore:ugc` (and a `namedDefinitions` entry that lasts the
whole session). `onMounted` fills it and sets `status` to `'ready'`. Only then does the inner component throw:
`ImageWidgetInner.vue:236` (`useCommonAdminImageOptions`) or `:634` (`useDamConfigState`). The user sees the same thing
either way (nothing rendered, the error goes to the error handler or Sentry), so the effect is small: an orphan store,
and a widget that does not refuse at setup as the library's components do. Today no call site passes a name (grep), so
nothing happens yet.

Proposed fix (no new export needed). In each wrapper, before `useDamConfigStoreOf`, call the exported
`useDamConfigState(undefined, props.configName)`: it checks the name, throws for one not in `coreDam.configs`, and asks
nothing because it has no client. Its `isDamPrvConfigLoaded()` can replace the read of `initialized.damPrvConfig`, so
the call is not there only to throw:

```ts
// A configuration the application has not got throws here and gets no store, as in common-admin's components.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { isDamPrvConfigLoaded } = useDamConfigState(undefined, props.configName)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigStore = useDamConfigStoreOf(props.configName)
```

For `default` nothing changes: `checkDamConfigName` returns at once, and the store is the same.

Case (red on the current tree): mount each wrapper with `configName: 'typo'` and an `app.config.errorHandler` that
collects. Expect the "Composable can't be used without properly configured common admin." error, no
`'commonAdminDamConfigStore:typo'` key in `pinia.state.value`, and `inner.configNames` empty. Today the stub takes
`'typo'` and the store exists. If the leader keeps the current decision instead, fix the note's sentence to say the
library's own `useDamConfigStoreOf` makes a store for any name too.

### Low 2. The changelog line is not exact about which licences each wrapper writes

Where: `doc/Admin-UGC-Changelog/Unreleased/3.0.0.md:49`, "ext system 4 for their licences". The code writes:
- `ImageWidget` and `ImageWidgetMultiple`: only `uploadLicence` (`ImageWidget.vue:102-105`,
  `ImageWidgetMultiple.vue:77-80`), not their `selectLicences`;
- `AssetList`: only `selectLicences` (`AssetList.vue:67-72`), not `uploadLicence`.

"(only while that configuration is not initialized yet)" also leaves out that the wrapper then marks the configuration
initialized (`initialized.damPrvConfig = true`, `ImageWidget.vue:99` and the same in the other two). PRAVIDLA 5 asks for
a sentence that says exactly what the code does.

Failure scenario: a reader of the changelog assumes the picker's licences are filled too, and gives `select-licences`
another licence. See "outside the step" 1.

Proposed wording: "...write it themselves: the image chunk sizes, marking the configuration initialized (only while it is
not initialized yet), ext system 4 for the upload licence (`ImageWidget`, `ImageWidgetMultiple`) or for the select
licences (`AssetList`), its custom forms and its image configuration."

## Checked and correct

- Scope: `diff -rq` of the snapshot `src` against the tree shows only the three wrappers and the new test. `git status`
  adds the changelog. The patch has 5 files and 273 lines, as reported.
- Each wrapper puts all five writes into the one store it takes in setup: the `initialized.damPrvConfig` check and flag,
  `imageChunkConfig`, licence to ext system 4, the custom forms of 4, and the ext-system configuration of 4 (`ImageWidget.vue:94-146`,
  `ImageWidgetMultiple.vue:69-121`, `AssetList.vue:59-114`). Nothing goes to `default` under another name. No
  `useDamConfigStore` is left in admin-ugc `src` (grep). `skip-current-user-check`, `EXT_SYSTEM_ID` and the texts are
  unchanged.
- `default` is exactly as before: `useDamConfigStoreOf('default')` is `useDamConfigStore(pinia)` (`damConfigStore.ts:105`),
  read at the same point in setup. Every one of the 7 call sites passes no name (grep), so "nothing changes on a page"
  holds.
- Under the name, the library reads the same members the wrappers fill: the getters of `useDamConfigState(..., name)`,
  chunk bounds `damUploadChunkSize.ts:15-16,50-54`, custom forms in `AAssetListInner.vue:82-85,229`. The library's own
  prefill helper fills the same set (`__tests__/support/namedDamConfig.ts:102-116`).
- `ImageWidgetSimple` really needs nothing: `AImageWidgetSimple.vue:49-55` reads only the image options, and
  `imageActions.ts` imports no store.
- The lint directive is needed: `vue/no-setup-props-reactivity-loss` is an error in the shared config
  (`node_modules/@anzusystems/common-admin/src/eslint/adminConfig.mjs:185`). The test is type-checked
  (`tsconfig.app.json:3-4` includes `src/test`).
- Test: real plugin with `default` and `own`, inner stubbed through `importOriginal`, so `useDamConfigStoreOf` is the
  library's own.
  - On the snapshot: 9 red at `:153/:174/:185`, each with `own` empty, which is the right reason
    (`pracovne/impl-ugc-pv14c/run1-snapshot.log`). The 3 cases without a name pass there as guards.
  - Bend A (`AssetList` back to `default`): 3 red. Bend B (`ImageWidget` reads `initialized` of `default`): 2 red, which
    shows the per-name `initialized` check is pinned. Both edits were applied (`bend-*-applied.log` = `0`).
  - After the change: 12/12, and the full suite has 16 files and 105 tests. The dts, tsc, format, oxlint, eslint,
    stylelint and build logs show no error, and the build ends "built". The logs do not record exit codes; I relied
    on their output.
- The note's older findings hold: the props in `withDefaults` that `ImageWidgetMultiple.vue:26-32` never declares, and
  the dead `'error'`/`'uploadNotAllowed'` branches (the status is only ever set to `'ready'`).

## Outside the step

1. Latent, no effect today. `ImageWidget`/`ImageWidgetMultiple` write only the upload licence, but the picker resolves
   every licence in `selectLicences` from the store (`ImageWidgetInner.vue:1302` -> `AAssetSelect.vue:245` ->
   `damConfigState.ts:288-303`). A licence that is not in the store is asked for at `/adm/v1/asset-licence/:id`, which
   the UGC routes do not offer, so it silently drops out of the picker (console error only). `AssetList` has the
   opposite gap (select licences only). All call sites pass `[damLicence]` equal to the upload licence
   (`GalleryEdit.vue:88-89`, `EmbedGalleryEditForm.vue:96-97`, `EmbedImageDialog.vue:127-128`, `ArticleEdit.vue:137-138`,
   `RegisterStepsPhoto.vue:63-64`, `ImageChangeDialog.vue:259-260`, `pages/dam/asset/index.vue:32-33`). Fix when
   needed: write the union of the upload and select licences in all three wrappers.
2. For a future named gallery. `AImageMassOperations` sits beside the wrapper, not inside it (`GalleryEdit.vue:100`,
   `EmbedGalleryEditForm.vue:108`). A name is only handed down to descendants (`damConfigName.ts:14-19`), so with
   `config-name` on `ImageWidgetMultiple` alone, the mass operations stay under `default`: its options, validation and
   store (`ImageMassOperations.vue:30,73,79`). A page that names the gallery must pass the same `config-name` to
   `AImageMassOperations`.
3. Known and systemic. `package.json:38` pins common-admin `1.47.0-beta.dev-1790143991`. Its archive in the yarn cache
   has no `useDamConfigStoreOf`, nor `createAnzuVuetify`, `ALayoutSwitch`, `defineApiClient` or `useRecordPage`, which
   `next` already uses. The pin has to be bumped to a build with PV14c-L1 before admin-ugc can build from a clean
   install.
