Code review: **no finding** in the three patches against the owner’s decisions.

- **Low — Test gap:** The media picker test checks that `modelValue` returns to `false`, but does not check that a second press repeats the warning. [consumerProfileImageWidgetLibrary.test.ts](/home/volar/projects/anzusystems/common-admin/src/domains/dam/imageWidget/__tests__/consumerProfileImageWidgetLibrary.test.ts:318)
- **Low — Register:** Finding 33 can also affect admin-dam’s three `AAssetSelect` uses when licence filtering rejects access; the register names only admin-cms. [navrh-komponenty.md](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-komponenty.md:1513)
- **Low — Notes:** The design still says the option returns `copyToLicenceEnabled ?? true`; the agreed implementation returns the raw value. [navrh-komponenty.md](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-komponenty.md:1026)
- **Outside change, Medium:** If a widget sets the picker model before configuration loads, `onOpen` returns while the model stays `true`; loading can then reveal a dialog without the licence check. [AAssetSelect.vue](/home/volar/projects/anzusystems/common-admin/src/domains/dam/assetSelect/components/AAssetSelect.vue:102) (same path in `AAssetSelectMedia`).

Tests were not run, as requested.