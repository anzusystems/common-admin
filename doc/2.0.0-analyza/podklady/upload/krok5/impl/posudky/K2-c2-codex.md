**Findings in the K2-c1 fixes**

- **Low — An omitted preset and an explicit `undefined` now have different types.** [useUpload](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/composables/uploadService.ts:80) rejects `useDamUpload(item, callback, undefined)` and a preset typed `UploadPreset<S> | undefined`, although the implementation treats `undefined` as the library preset. Add an overload for that case if the previous public call form must remain valid.
- **Test quality — The runtime `toThrow()` assertion** in [uploadServicePresets.test.ts](/home/volar/projects/anzusystems/common-admin/src/domains/dam/uploadQueue/__tests__/uploadServicePresets.test.ts:204) would still pass with the old unsafe overload: the missing plugin configuration causes the throw. The `@ts-expect-error` is the effective guard.

**Outside the patch**

- **Low — The design still shows the unsafe optional generic signature** at [navrh-jadro.md](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md:709). Its K3 call supplies a preset, but the signature should be updated before it guides later work.

`lint:tsc` references `tsconfig.test.json`, which includes this test; the positive type assertions and `@ts-expect-error` can fail type checking. I found no further mismatch in Z5/B9, Z12 or Z32. This was read only; I ran neither tests nor `tsc`.