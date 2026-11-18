# PV14c-D1: admin-dam na knižnici s pomenovanými konfiguráciami DAM (impl-dam-op12)

Zadanie `krok5-praca/zadania/zadanie-PV14c-D1.md`, plán `zadania/plan-PV14c.md`. Strom `admin-dam`, vetva `next`, čistý
na `0d4ec26f`; knižnica v `node_modules` = kópia C17a (PV14c-L1 až L6). Snímok **`PV14c-D1`**. **Kód sa nemenil**,
záplata ani changelog nie sú. Knižnica sa nemenila, žiadny zápis do gitu.

## Kontrola

- `CK_CAST=testy`: **150 súborov, 2 068 prípadov, zelené** (`vysledky/PV14c-D1-testy.log`), rovnako ako po OP13-D4-c1.
- `CK_CAST=linty`: **zelené** (`generate:dts`, `lint:tsc`, `format:check`, `oxlint`, `eslint`, `stylelint`, `build`;
  `vysledky/PV14c-D1-linty.log`).

## Čo som overil čítaním (changelog knižnice `doc/changelog/2.0.0.md:74-81`, „Named DAM configurations")

- **Len `default`.** `src/main.ts` dáva `coreDam.configs` len `default` (`coreDamDefaultConfig`,
  `src/plugins/commonAdminCoreDam.ts`), s koreňovým `notification`, `apiTimeout` a `adminDomain`; v `src/` admin-dam nie je
  nikde `configName`. Bez mena a bez predka s menom berú cache mien (`useCachedAuthors`, `useCachedKeywords`,
  `useDamCachedUsers`), `useExtSystemIdForCached()` na úrovni modulu (`currentExtSystem.ts`), `useDamConfigState(damClient)`,
  `useDamConfigStore()`, `useDamNotificationsConnection()` a nahrávanie (`useDamUpload` s `adminDamUploadPreset`) stav
  `default`.
- **Poslucháč notifikácií počuje len soket `default`.** `appNotificationListeners.ts` volá
  `addDamNotificationListener(callback)` bez možností; v nainštalovanej knižnici (`dist/domains/dam/composables/damNotifications.js`)
  obal bez `configName` a bez `all` pustí udalosť len vtedy, keď mená jej soketu obsahujú `default` (udalosť bez mien
  sa berie za `default`). Druhý argument spätného volania (mená konfigurácií) admin-dam nečíta. `initDamNotifications()`
  pri jednej konfigurácii otvorí jeden soket, ako doteraz.
- **Profil usadzovania bez mien usadzuje ako doteraz.** Profil v `A/store/uploadQueuesStore.ts` nemá `configOf` a
  `adminDamQueuePreset` (`dist/…/presets/queuePresets.js`) ho podáva bez zmeny. V `dist/…/settlement/uploadSettle.js`
  a `uploadSettlement.js` bez `configOf`: zhoda riadkov ako predtým (`!configOf || …`), čítania v jednom pruhu
  (`configOf ? kľúč : undefined`), cache volané s jedným argumentom (`addAuthors(ids)`, `fetchAuthors()`), takže
  `addToCachedAuthors` z `defineCached` nedostane kľúč frontu ako ďalšie id. `connection` je
  `useDamNotificationsConnection()` bez mena, teda soket `default`.

## Neisté

- Overené čítaním zostavenej knižnice a celou sadou admin-dam (bez mena); v prehliadači nič. Plán PV14c pre D1 nič
  viac nežiada.
