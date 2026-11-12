Patch: **no finding**. The new test can fail when the conflict list does not react to `modelValue`; awaiting `setProps` makes its assertion deterministic. [Test](/home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src/domains/dam/__tests__/damNameInputs.test.ts:323)

The revised [N44 description](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/impl/N44.md:38) matches the code: the change appears in the admin-cms queue row and single-file dialog, nowhere in admin-ugc, and in admin-dam’s detail after U3 and queue row after U5c.

Cycle 1: no unresolved N44 defect. The admin-dam row test update remains explicitly deferred to U5c.

Outside this change, the two earlier findings remain: [single-select conflict clicks](/home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue:104) mishandle scalar or null values, and [conflict collection](/home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src/domains/dam/uploadQueue/composables/assetSuggestions.ts:14) can return duplicate IDs. Tests were not run.