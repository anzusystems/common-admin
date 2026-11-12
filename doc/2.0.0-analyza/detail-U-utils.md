# U — Core utils (detail)

13 bugov v najpoužívanejších moduloch. Patche: `batch3/coretests-out/tests.patch` (14 testov + helper `src/test/support/commonVuetify.ts` + `vitest.config.mts`), `fixes.patch` (11 súborov). Všetky opravy prešli vue-tsc, eslint, oxlint, oxfmt; testy bežia aj v zóne America/New_York. Cesty relatívne k `src/`.

---

## U1 — `getMonthInterval` obrátený interval · TEST ✓
- **Kde:** `utils/datetime.ts:148` — `from.setMonth(m + offset)` a až potom `setDate(1)`. Pri chýbajúcom dni (napr. 31.) mesiac pretečie.
- **Scenár:** 31. 3. mínus mesiac → `setMonth` dá 31. 2. → pretečie na 3. 3. → `setDate(1)` = 1. 3.; koniec intervalu je 28. 2. → „Minulý mesiac“ vráti obrátený interval, zoznam prázdny. „Posledné 3 mesiace“ pokryjú len 2 mesiace 29.–30. 4. a 31. 8.
- **Postihuje:** cms filtre Article, Box, BoxGroup, Poll, Quiz, SuperAuthor, AutoDistribution, UserArticle, ArticlePurchase (cez `useApiQueryBuilder.ts:74-80`). 5 dní v roku „minulý mesiac“, 3 dni „3 mesiace“.
- **Oprava:** `from.setMonth(from.getMonth() + offset, 1)`.
- **Test:** `src/test/utils/datetime.test.ts` (obe zóny).

## U2 — `stringIsValidEmail` odmieta plus-adresu · TEST
- **Kde:** `utils/string.ts:107`. `jan+news@gmail.com` → false. V cms potom `linkAttrs.ts` berie adresu ako web link.
- **Oprava:** povoliť `+` v local-part.

## U3 — `stringToSlug` · TEST
- **Kde:** `utils/string.ts:63-76`. Ponecháva `_` (vlastný slug validátor `useValidateSlug.ts:9` ho odmietne); zahadzuje písmená bez rozkladu na písmeno+diakritiku (`Łukasz Żółć`→`ukasz-zoc`, `Straße`→`strae`). cms robí slugy z mien autorov.
- **Oprava:** `_`→`-` + malá transliteračná mapa (ł ß đ ø æ œ þ ħ ı).

## U4 — `ADatatableOrdering` plytký watch · TEST
- **Kde:** `labs/filters/ADatatableOrdering.vue:133` — watch na pagination ref plytko, in-place `pagination.value.sortBy = …` sa neprejaví. cms `DashboardStageDatatable.vue:112` to obchádza ručne.
- **Oprava:** watch getter na `sortBy.key`/`sortBy.order`.

## U5 — `AActionDeleteButton` varianty ignorujú `disabled`/`loading` · TEST
- **Kde:** riadky 113-124 — primary/secondary/tertiary variant otvorí delete dialóg aj keď je disabled. Admini používajú default icon variant, dnes nezasiahne.
- **Oprava:** prepustiť oba props.

## U6 — `prettyDuration` pretečie po dni · TEST
- **Kde:** `utils/file.ts:19-23` — 86400 s → `00:00:00`. cms media obrazovky; dam má vlastnú kópiu s tým istým bugom.
- **Oprava:** opraviť výpočet hodín.

## U7 — Ikonové varianty Edit/Create · TEST
- **Kde:** `AActionEditButton:79`, `AActionCreateButton:51` — icon variant má `mdi-content-save`.
- **Oprava:** `mdi-pencil`, `mdi-plus`.

## U8 — `isInt` orezáva na 32 bitov · TEST
- **Kde:** `utils/common.ts:47` — `(x|0)===x`, `isInt(2147483648)`→false. cms ním kontroluje id.
- **Oprava:** `Number.isInteger`.

## U9 — `arrayFlatten([1,[]])`→`[]` · TEST
- **Kde:** `utils/array.ts:14-20`. Prázdna skupina na konci zahodí všetko pred ňou. dam `FileUpload.vue:268`.

## U10 — `object*ValueByPath` pri null medzikroku · TEST
- **Kde:** `utils/object.ts` — `objectGetValueByPath` (`:19`) hádže TypeError na null medzikroku (ACachedChip, translatePermission); `objectDeletePropertyByPath` (`:41`) hádže pri chýbajúcom kroku; `objectSetValueByPath` hádže pri null, po oprave vytvorí ako lodash `set`.
- **Oprava:** null/primitív nahradiť `{}` resp. vrátiť undefined.

## U11 — `cloneDeep` a `stringUrlTemplateReplace` · TEST
- **Kde:** `utils/common.ts:74-89` — `cloneDeep` pri poli/objekte s reactive deťmi spadne na JSON (Date→string, Map→`{}`); `cloneDeep(ref(obj))` vráti vnútro refu alebo hodí circular JSON. `utils/string.ts:~100` `stringUrlTemplateReplace` neenkóduje parametre (log detail z `route.params.id`).
- **Oprava:** deep `toRaw` (unwrap refov) pred `structuredClone`; `encodeURIComponent(params[key])`.

## U12 — `parseBoolean`, `dateTimeNow(false)` · TEST
- **Kde:** `utils/boolean.ts:13` `parseBoolean('   ')`→true (`''`→false); `utils/datetime.ts:28-29` `dateTimeNow(false)` — dayjs nemá 6-miestny token, 12.345 s vypíše `.345345Z`.

## Zdokumentované zámerné správanie (má „Documented“ test)
`stringToInt('12abc')`→12 (parseInt), `stringToFloat('48,1486')`→48, `stringToNumber('0x10')`→16, `isEmpty(0)`→true, `isEmpty(false)`→false, vuelidate `url` odmieta localhost, `numeric` odmieta `-1`/`1,5`, `prettyBytes(1048575)`→`1024 KB`.

## Na rozhodnutie (viď rozhodnutia.md)
- `AFormTextField`/`AFormTextarea` majú `trim` atribút, ktorý nič nerobí.
- `AActionDeleteButton` má `dialogZIndex`/`dialogMaxWidth`, ktoré sa nepoužívajú.
