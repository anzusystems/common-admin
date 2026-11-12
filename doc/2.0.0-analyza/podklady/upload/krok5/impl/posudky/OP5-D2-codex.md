1. **Low — FE-49 is incomplete while loading.** The loaded detail disables navigation at the ends, but [AssetDetailDialogLoader.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/detail/components/AssetDetailDialogLoader.vue:44) renders both buttons enabled with no action. This also qualifies the claim in the [changelog](/home/volar/projects/anzusystems/admin-dam/doc/changelog/3.0.0.md:135) that the end buttons cannot be pressed.

**Outside the patch:**

2. **Medium — Unsaved metadata can still be lost on standalone detail pages.** After a successful route change, [AssetDetailView.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/detail/AssetDetailView.vue:233) and [AssetFileDetailView.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/detail/AssetFileDetailView.vue:210) reread and replace the whole asset without the FE-47 protection.

3. **Medium — A rejected route change can remain silent.** The handlers call `showErrorsDefault` for a raw request error, which may display nothing; suppressing the refresh event also removes the former visible loader. See [AssetFileMainRoute.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/shared/assetFileRoute/components/AssetFileMainRoute.vue:47) and [AssetFileRouteMakePublicDialog.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/shared/assetFileRoute/components/AssetFileRouteMakePublicDialog.vue:83).

4. **Low — A main slot’s route can look stale in Info.** Its listener refreshes only the slot list, leaving the held asset’s `mainFile` unchanged: [AssetSlotListItem.vue](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/detail/components/slots/AssetSlotListItem.vue:179).

No other finding in the reviewed fixes, tests, note, or changelog. I did not run tests, as requested.