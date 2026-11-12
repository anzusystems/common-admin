# Vypnutie notifikácií v core-dam a zrušenie notification-server: plán pre backend a prevádzku

Analýza 9. 10. 2026, len čítaním kódu. Nič sa nespúšťalo (žiadny build, test, kontajner, `bin/console`, žiadna
požiadavka na server ani do cloudu). Čo je odvodené a nie prečítané z riadku, nesie slovo **odvodené**; čo sa
z kódu zistiť nedá, je v časti 4. Nadväzuje na `podklady/upload/2-notif-be.md` (ďalej „BE-analýza") a opravuje
v nej dve veci (2.1, bod 6 a 2.3, záver).

**Oprava po overení (9. 10.)** podľa posudku Codexu (`posudok-be-vypnutie-notifikacii-codex.md`); text nižšie je
už opravený:

| # | Čo bolo zle alebo nepresne | Oprava |
|---|---|---|
| 1 | Premenné frontendov sa mali mazať v K5, šablóny upratať až v K6 | Premenné sa mažú **až po zmene kódu a šablón nasadenia** (nový krok K7). admin-dam: `NOTIFICATION_*` ostávajú, kým šablóna `DAMDEPLOY/public/config.json.cf.dist:19-22` blok `notification` má. admin-cms: `DAM_NOTIFICATION_*` ostávajú, kým sa nezmení kód (`CMS/src/shared/EnvConfigService.ts:186-187` blok vyžaduje) **aj** šablóna: zástupný znak `enabled` je v nej bez úvodzoviek (`CMS/public/config.json.cf.dist:72`), takže bez premennej by ďalšie nasadenie mohlo vyrobiť neplatný JSON (odvodené; čo úloha nasadenia urobí s chýbajúcou premennou, nevidno) |
| 2 | Návrat K5 = „znova nasadiť a škálovať" | Návrat K5 musí obnoviť všetko zmazané: tému, odbery, práva, k8s objekty, DNS, certifikát, pipeline a skupiny premenných; samotné škálovanie nestačí |
| 3 | Niektoré tvrdenia znejú ako overené | Z kódu **neoveriteľné**: nasadená verzia admin-dam (1.28.0 je len údaj z `DAMDEPLOY/github.version`; zdroj značky 1.28.0 som čítal v lokálnom git), existencia odberu `notification_server_internal` v produkcii, hodnoty premenných, a to, že sa kontajner s vypnutým prepínačom **zostaví** (z čítania DI pravdepodobné; ukáže CI). admin-ugc má službu vypnutú v **dnešnom** kóde; čo robil kedysi, nevidno |
| 4 | Príkaz v `run-migrations` | Skript volá `messenger:setup-transport` (jednotné číslo); Symfony registruje `messenger:setup-transports` a jednoznačnú skratku prijme (`SF/console/Application.php:730-737`, `find()`) |
| 5 | Chýbal dôvod vypnúť notifikácie v adminoch skoro | So zapnutými notifikáciami platí okno nálezu 51 (51b, `upload-postup.md:170`): riadok uploadu sa odomkne notifikáciou o metadátach, kým spracovanie ešte beží, a uloženie môže spracovanie prepísať. Pri samotnom dopytovaní sa formulár otvorí až pri `processed` (R4), toto okno nevzniká. Ďalší dôvod spraviť K2 čo najskôr po K1 |

| Skratka | Cesta | Verzia, stav |
|---|---|---|
| `B/` | `/home/volar/projects/petit/core-dam/vendor/anzusystems/core-dam-bundle/src/` | 1.52.0 |
| `APP/` | `/home/volar/projects/petit/core-dam/` | HEAD `890bdfa`, čistý strom |
| `GPS/` | `APP/vendor/petitpress/gps-messenger-bundle/src/` | 4.0.0 |
| `GC/` | `APP/vendor/google/` | cloud-core 1.73.2, cloud-pubsub 2.20.0 |
| `SF/` | `APP/vendor/symfony/` | 8.1.5 |
| `NS/` | `/home/volar/projects/anzusystems/notification-server/` | 1.2.1, HEAD `fc0369f` |
| `LIB/` | `/home/volar/projects/anzusystems/common-admin/` | `next`, kroky 0-3 necommitnuté |
| `DAM/` | `/home/volar/projects/anzusystems/admin-dam/` | `next`, kroky 0-3 necommitnuté |
| `DAMDEPLOY/` | `/home/volar/projects/petit/admin-dam/` | obal nasadenia admin-dam, `github.version` = `1.28.0` |
| `CMS/`, `UGC/` | `/home/volar/projects/petit/admin-cms/`, `/home/volar/projects/petit/admin-ugc/` | knižnica `1.47.0-beta…` |

## 0. Zhrnutie

1. Backendová zmena je jeden riadok v `APP/config/packages/settings.php:59-63`: `'enabled' => false` v bloku
   `notifications`, napísané priamo (nie cez env). Podľa čítania DI by sa kontajner mal zostaviť; neoverené, ukáže CI.
2. Väzba z BE-analýzy 8.1 platí a je širšia: zlyhané publikovanie prepíše uložený alebo spracovaný súbor na
   `failed/unknown`, nechá súbor po dokončení uploadu navždy `uploaded` a zasekne distribúcie. Že klient Google
   výnimku naozaj vyhodí, je teraz overené v jeho kóde.
3. Tému `notification_server_internal` dnes vytvárajú **dvaja**: služba pri štarte a core-dam pri každom nasadení
   (`messenger:setup-transports` v úlohe migrácií), ktorý k nej navyše zakladá odber bez konzumenta (odvodené).
   Zmazať ju preto treba až po vypnutí v core-dam aj po zastavení služby.
4. Nutná brána je **admin-dam 3.0**: admin-dam pred 3.0 so šablónou nasadenia bez kľúča `uploadStatusFallback`
   nemá zálohu dopytovaním, bez notifikácií by uploady, distribúcie aj YouTube ostali visieť (ktorá verzia je
   naozaj nasadená, z kódu overiť nejde). admin-ugc bránou nie je (dnešný kód službu natvrdo vypína). admin-cms je
   bránou len vtedy, ak má v produkcii službu zapnutú (premennú treba pozrieť).
5. Prepínač pre každý externý systém sa na postupné nasadenie nehodí: nevypne `user_updated` ani
   `distribution_authorized`, nechá tému aj transport v DI a ten istý systém `cms` používa admin-cms aj admin-dam.
   Postupne sa ide po prostrediach.
6. Od služby po kroku 3 už závisí len `user_updated` (zmena práv sa v admin-dam prejaví až po načítaní stránky).
   Nález 13 (YouTube) od služby nezávisí: backend neúspešné prihlásenie neoznamuje ani dnes.

---

## 1. Udalosti: kde ich core-dam posiela, kto ich počúva, čo ich nahrádza

Všetko publikuje jedna metóda `B/Notification/AbstractNotificationDispatcher.php:55-83`. Žiadny frontend nepočúva
nič, čo nie je v tabuľke; admin-blog, admin-forum a admin-inhouse DAM v knižnici nenastavujú (ich `src/main.ts`
nemá `coreDam`). Iný vydavateľ do tejto témy v lokálnych repozitároch nie je (hľadanie `targetSsoUserIds`
a `notification_server_internal` cez `/home/volar/projects`).

| Udalosť | Kde core-dam publikuje | Kto ju dnes počúva | Čo ju nahrádza bez služby |
|---|---|---|---|
| `asset_file_uploaded` | `B/Domain/AssetFile/AbstractAssetFileStatusFacade.php:196` | nikto (LIB ju nepreloží na usadenie, `LIB/src/domains/dam/uploadQueue/store/uploadQueuesStore.ts:151-171`; DAM ju nemá v prepínači, `DAM/src/domains/system/composables/appNotificationListeners.ts:28-68`) | netreba: odpoveď dokončenia nesie `uploaded` |
| `asset_file_stored` | `AbstractAssetFileStatusFacade.php:289` | nikto (nie je ani v zozname mien, `LIB/src/domains/dam/composables/damNotificationsEventBus.ts:13-29`) | netreba |
| `asset_file_processed`, `_failed`, `_duplicate` | `:318`, `:244`/`:252`, `:236` | LIB `uploadQueuesStore.ts:153-163`; DAM `appNotificationListeners.ts:30-43` | dopytovanie spoločného usadzovania: LIB `uploadQueuesStore.ts:87-95` (hromadné čítanie `…/licence/{licence}/ids/{ids}`), DAM `DAM/src/domains/coreDam/asset/store/uploadQueuesStore.ts:124-125,199-205,219-284` (aj sloty cez `asset-slot/asset/{asset}`); rytmus bez služby 5, 10, 16 … 60 s, potom každých 30 s (`LIB/src/domains/dam/uploadQueue/settlement/uploadPollSchedule.ts:15-24`) |
| `asset_metadata_processed` | `B/Domain/AssetFile/FileProcessor/MetadataProcessor.php:43` | LIB `uploadQueuesStore.ts:165`; DAM `appNotificationListeners.ts:44-46` | formulár sa otvorí pri `processed` (rozhodnutie R4, `upload-plan.md:49`) |
| `asset_file_copied` | `B/Domain/Image/ImageCopyFacade.php:122-124` | LIB `uploadQueuesStore.ts:167` | riadok kópie sa sleduje od začiatku (`uploadQueuesStore.ts:206-235`) |
| `asset_file_deleted`, `asset_deleted` | `B/Domain/AssetFile/AbstractAssetFileFacade.php:321-327`, `B/Domain/Asset/AssetFacade.php:149-150` a dve dávkové cesty | nikto | netreba |
| `distribution_distributing`, `_remote_processing`, `_distributed`, `_failed` | `B/Domain/Distribution/DistributionStatusFacade.php:59` | DAM `appNotificationListeners.ts:47-58` | `DAM/src/domains/coreDam/asset/composables/distributionListPoll.ts:22-27,56` (15 s, 30 s, každých 30 s do 5 min, potom každú minútu, kým je karta otvorená a niečo beží) |
| `distribution_authorized` | `B/Distribution/Modules/Youtube/YoutubeAuthenticator.php:89-94` | DAM `appNotificationListeners.ts:59-61` | nové overenie pri návrate do okna, `DAM/…/distribution/DistributionNewDialogYoutube.vue:205-220,293-294` |
| `user_updated` | `APP/src/Notification/UserNotificationDispatcher.php:17-20`, volané z `APP/src/Domain/User/UserFacade.php:60,73,86` a `DeprecatedUserFacade.php:39,69,82` | DAM `appNotificationListeners.ts:62-66` (znova načíta používateľa) | **nič** (R5: „`user_updated` neskôr", `upload-plan.md:50`) |

Čo po vypnutí ešte závisí od služby:

1. **admin-dam pred 3.0**, celé. Šablóna nasadenia nemá `uploadStatusFallback` (`DAMDEPLOY/public/config.json.cf.dist:1-26`)
   a admin-dam ním prepisuje svoju predvolenú hodnotu (v značke 1.28.0 `src/services/EnvConfigService.ts:50`,
   záloha `src/services/api/coreDam/fileApi.ts:141,154`; rovnako 2.2.0). Záloha je teda v produkcii vypnutá
   (zhodne `podklady/upload/1-notif-fe.md`, fakt 10). `DAMDEPLOY/github.version` hovorí 1.28.0 (súbor zmenený
   11. 3. 2026); skutočne nasadenú verziu z kódu **overiť nejde**.
2. **admin-cms so starou knižnicou a zapnutou službou**: záloha je zapnutá natvrdo (`CMS/src/main.ts:64`), číta
   asset po 10, 50, 140, 300 s a pri 550 s sa vzdá (`1-notif-fe.md`, fakt 1). Bez notifikácií upload v CMS
   funguje, ale pomalšie a dávka spracúvaná dlhšie než 550 s ostane „spracúva sa".
3. **`user_updated`**: bez náhrady (bod 6 v „Pre vlastníka").
4. **YouTube (nález 13)**: od služby **nezávisí**. Udalosť sa vytvára na jedinom mieste a vždy s `success = true`
   (`YoutubeAuthenticator.php:89-94`, predvolená hodnota `B/Event/DistributionAuthorized.php:12`); keď prihlásenie
   zlyhá, výmena kódu vyhodí výnimku skôr (`YoutubeAuthenticator.php:86-87,103-110`) a žiadna udalosť nevznikne.
   Stav „neúspech" v admin-dam (`DAM/src/domains/coreDam/asset/store/distributionListStore.ts:38-48`) je z backendu
   nedosiahnuteľný aj so službou. Predpoklad nálezu 13 v denníku („So službou príde notifikácia a dialóg ukáže
   neúspech", `upload-postup.md:117`) nesedí; služba dáva YouTube len rýchlejšie hlásenie úspechu.

---

## 2. Prepínače: čo presne vypínajú

### 2.1 `anzu_systems_core_dam.settings.notifications.enabled: false`

1. **Publikovanie.** `notify()` sa vráti hneď na začiatku (`AbstractNotificationDispatcher.php:57-60`), skôr než
   vytvorí klienta. Platí pre všetky štyri triedy, ktoré z neho dedia: `AssetFileNotificationDispatcher`,
   `AssetNotificationDispatcher`, `DistributionNotificationDispatcher` (všetky `B/Notification/`) a
   `APP/src/Notification/UserNotificationDispatcher.php:10`. Hodnotu číta `B/Model/Configuration/SettingsConfiguration.php:70`
   cez `NotificationsConfiguration.php:24,35-38`.
2. **Volanie REST pri každom prechode stavu zaniká.** Dnes každé `notify()` vytvorí nový `PubSubClient` s REST
   transportom (`AbstractNotificationDispatcher.php:69-72`, `APP/config/packages/settings.php:59-63`) a synchrónne
   publikuje (`:74-82`, `GC/cloud-pubsub/src/Topic.php:567-592`), v požiadavke `PATCH …/uploaded` aj vo
   workeroch; obrázok ich má štyri až päť (BE-analýza 7).
3. **DI.** Rozšírenie prejde každý surový kúsok konfigurácie s kľúčom `settings` (`B/DependencyInjection/AnzuSystemsCoreDamExtension.php:444-446`)
   a blok pre notifikácie pridá, keď `$configSettings['notifications']['enabled'] ?? true` je `true` (`:510`).
   S `false` nevznikne: téma a prístupové údaje v nastaveniach (`:511-524`), pool `core_dam_bundle.pub_sub_token_cache`
   (`:526-530`), transport messengera pomenovaný podľa témy (`:534-552`).
4. **Zostavenie kontajnera** (odvodené z kódu, nespúšťané, **neoverené**; ukáže CI po K3): jediný, kto pool chce, je setter
   `setCoreDamBundlePubSubTokenCache(CacheItemPoolInterface $coreDamBundlePubSubTokenCache)` (`AbstractNotificationDispatcher.php:44-48`).
   Bez pomenovaného aliasu autowiring siahne po aliase typu (`SF/dependency-injection/Compiler/AutowirePass.php:499-521`),
   ktorý FrameworkBundle definuje na `cache.app` (`SF/framework-bundle/Resources/config/cache.php:269`). Nikto iný pool
   ani transport nemenuje (hľadanie v `B/`, `APP/src`, `APP/config`; supervisor `APP/docker/bin/messenger-supervisor-conf:4-19`
   a k8s ho nemajú). Uzly `topic` a `gps_config` nie sú povinné (`B/DependencyInjection/Configuration.php:182-193`).
5. **`messenger:setup-transports`** (beží pri každom nasadení, `APP/docker/bin/run-migrations:13-14`, úloha
   `APP/docker/kubernetes/migrations-job.yaml:26`; skript píše `setup-transport` v jednotnom čísle, Symfony
   jednoznačnú skratku prijme, `SF/console/Application.php:730-737`) prestane tému a jej odber zakladať (2.3).
6. **Oprava BE-analýzy 2.5:** testovacie prostredie dnes **nedokazuje**, že sa kontajner bez poolu zostaví. Hlavný
   kúsok `settings.php` nemá `enabled`, takže `?? true` blok pridá aj v teste; `false` z `APP/config/packages/test/anzu_systems_core_dam.php:15-17`
   ho už neodoberie. Po zmene v `settings.php` bude blok chýbať aj v teste, takže CI (`phpunit`) zostavenie overí.
7. **Čo ostáva:** udalosti Symfony a ich ďalší poslucháči (obnova vlastností pri duplikáte, čistenie výrezov,
   poslucháči aplikácie, BE-analýza 2.5), zapisovanie `notifyTo`.
8. **Ako to napísať** (pasce, všetky odvodené z `:444-446,510`):
   - len ako pole s doslovným `false`: `'notifications' => ['enabled' => false]`;
   - skratka `'notifications' => false` nestačí: surová hodnota nie je pole, `?? true` dá `true` a téma, pool aj
     transport ostanú (publikovať sa nebude, ale nasadenia budú tému ďalej zakladať);
   - nie cez env (`env('…')->bool()`): v surovej konfigurácii je to reťazec, blok s témou a údajmi sa nepridá, a keby
     env za behu povedal `true`, publikovalo by sa do prázdnej témy bez údajov a padalo by to;
   - blok `notifications` sa nesmie neskôr „upratať" preč: predvolená hodnota je zapnuté (`Configuration.php:184`,
     `NotificationsConfiguration.php:24`). Ostáva natrvalo;
   - iný kúsok s `anzu_systems_core_dam.settings` v produkcii nie je (len `settings.php`, v teste navyše
     `test/anzu_systems_core_dam.php`; `config/packages/prod/storages.php` nastavuje len úložiská).

### 2.2 `ext_systems.<slug>.notifications_enabled: false`

1. `notify()` sa vráti na `:62-67`, **len keď volajúci podá slug**. Podávajú ho udalosti súborov
   (`B/Notification/AssetFileNotificationDispatcher.php:38,55,71,87`), assetu (`AssetNotificationDispatcher.php:26`)
   a stavu distribúcie (`DistributionNotificationDispatcher.php:33`). **Nepodáva** `distribution_authorized`
   (`DistributionNotificationDispatcher.php:42-46`) ani `user_updated` (`UserNotificationDispatcher.php:19`): tie sa
   publikujú ďalej.
2. DI sa nemení: téma, pool aj transport ostávajú, `setup-transports` ich zakladá ďalej, téma musí žiť.
3. Hodnota je v API (`GET /api/adm/v1/configuration/ext-system/{extSystem}`, `B/Model/Decorator/ExtSystemAdmGetDecorator.php:40-44`),
   no žiadny frontend ju nečíta (hľadanie `notificationsEnabled` v LIB, DAM, CMS, UGC: nič). Pri vypnutom globálnom
   prepínači API ďalej hlási `true`, ak sa nenastaví aj tu.
4. Externé systémy nezodpovedajú aplikáciám: v core-dam je deväť systémov (`APP/config/packages/anzu_systems_core_dam_ext_systems.php:10-704`),
   a systém `cms` (id 1, predvolený, `settings.php:40`) používa admin-cms aj admin-dam (odvodené). Vypnúť ho pre
   jednu aplikáciu sa nedá.
5. Záver: na postupné nasadenie sa nehodí. Postupne sa ide po prostrediach (dev, stage, prod). Nastaviť ho všade
   na `false` má zmysel len pre poctivú odpoveď API, nikto ju nepotrebuje.

### 2.3 Väzba „zlyhané publikovanie zhodí prechod stavu" (BE-analýza 8.1): overená

**Klient výnimku vyhodí** (overené): `publishBatch` ide cez `RequestHandler::sendRequest` (`GC/cloud-pubsub/src/Topic.php:586-592`),
ktorý `ApiException` mení na výnimku Google a vyhodí ju (`GC/cloud-core/src/RequestHandler.php:121-122`). Či ju
dostane chýbajúca téma, odobraté právo aj výpadok, je z kódu jasné; presný typ pri 404 som nesledoval.
Nikde medzi `notify()` a prechodom stavu nie je `try/catch`, okrem miest uvedených nižšie.

**Poradie poslucháčov** (overené v SF): poslucháči s `#[AsEventListener]` sa registrujú pred subscribermi
(`SF/event-dispatcher/DependencyInjection/RegisterListenersPass.php:84-130` a `:146-180`) a pri rovnakej priorite
ostáva poradie pridania (`SF/event-dispatcher/EventDispatcher.php:213-216`). Poslucháči aplikácie na tých istých
udalostiach (`APP/src/Event/Listener/AudioFileProcessedListener.php:16`, `MediaApiChangeStateEventListener.php:18`,
`DistributionStatusEventListener.php:18`, `AssetFileDeleteListener.php:15`) teda bežia skôr a vynechaní nie sú.
Vynechá sa to, čo je **za** `notify()`.

| # | Udalosť a miesto | Kde beží | Čo sa stane, keď publikovanie vyhodí | Dôsledok |
|---|---|---|---|---|
| 1 | `asset_file_uploaded`, `AbstractAssetFileStatusFacade.php:194-197` | HTTP `PATCH …/uploaded` | `uploaded` je zapísané (`:194`, `B/Domain/AssetFile/AssetFileStatusManager.php:33-40,102-114`), výnimka vyletí pred `:197` | správa na spracovanie sa nepošle, súbor ostane `uploaded` navždy; klient dostane chybu (LIB aj DAM ju berú ako „nevieme" a čítajú ďalej, po 20 min „trvá príliš dlho") |
| 2 | `asset_file_stored`, `:289` | worker | chytí `:245`, `toFailed(unknown)` (`:247-251`), druhé publikovanie v `:252` zlyhá tiež, výnimka vyletí z `storeAndProcess`; handler ju zapíše a vyhodí (`B/Messenger/Handler/AssetFileChangeStateHandler.php:101-113`), správa príde znova a stav `failed` preskočí (`:88-99`) | uložený súbor skončí `failed/unknown` |
| 3 | `asset_metadata_processed` v `process()`, `:306` | worker, v transakcii `:302-309` | rollback `:314`, ďalej ako 2 | `failed/unknown` |
| 4 | `asset_file_processed`, `:318` | worker, po commite | ako 2; `processed → failed` je povolený (`AssetFileStatusManager.php:126-128`) | spracovaný súbor sa prepíše na `failed/unknown` (asset ostane `with_file`) |
| 5 | `asset_file_duplicate` `:236`, `asset_file_failed` `:244`, `:252` | worker, v `catch` | stav je zapísaný, výnimka vyletí z `catch` | stav správny; pri duplikáte sa nepošle obnova vlastností assetu, lebo `notify()` je pred ňou (`B/Event/Subscriber/AssetFileEventSubscriber.php:34-41`) |
| 6 | `asset_metadata_processed` z prvého kúska, `MetadataProcessor.php:39-43` | worker metadát | metadáta zapísané, správa sa opakuje, kým kúsok existuje (`B/Messenger/Handler/AssetFileMetadataProcessHandler.php:35-48`) | opakovaná práca a log |
| 7 | `asset_file_copied`, `ImageCopyFacade.php:122-124` | worker kópie | kópia je commitnutá (`:105-113`), správa sa opakuje a `copyAssetFiles` beží znova (`B/Messenger/Handler/CopyAssetFileMessageHandler.php:32-44`) | kópia hotová, opakovaná práca (odvodené) |
| 8 | mazania: `AssetFacade.php:146-157`, `AbstractAssetFileFacade.php:318-334`, `B/Domain/AssetLicence/AssetLicenceRetentionFacade.php:92-100` | HTTP, worker, cron | chránené `try/catch` s logom | nič, len log |
| 8b | mazanie v úlohe GDPR, `B/Domain/Job/Processor/JobUserDataDeleteProcessor.php:84-91` | úloha | nechránené: po `commit` (`:84`) padne do `catch`, ktorý volá `rollback` (`:90`) bez otvorenej transakcie | úloha cyklus nedokončí (odvodené: Doctrine pri `rollback` bez transakcie hádže) |
| 9 | stav distribúcie, `DistributionStatusFacade.php:45-61` | worker | stav commitnutý, výnimka vyletí pred ďalším krokom | po `toDistributing` (`B/Distribution/DistributionBroker.php:74`) sa modul nespustí a správa sa opakuje (`B/Messenger/Handler/DistributeHandler.php:42-44`); po `toRemoteProcessing` (`:101-102`) sa nepošle kontrola, visí `remote_processing`; po `toDistributed` (`:141-146`) sa neobnovia vlastnosti a nespustia zablokované distribúcie |
| 10 | `distribution_authorized`, `YoutubeAuthenticator.php:89-94` | HTTP spätné volanie OAuth | token je vymenený, presmerovanie sa nevráti (`B/Controller/YoutubeController.php:33-41`) | prihlásenie platí, okno ukáže chybu |
| 11 | `user_updated`, `UserFacade.php:60,73,86` | HTTP | uložené, odpoveď chyba | chyba pri uložení používateľa, hoci sa uložil |

Tému dnes zakladajú dvaja, preto ju zmazať pred krokom K3 nejde ani prakticky:
- služba pri štarte tému a svoj odber (`NS/src/pubsub/notification-pub-sub.ts:65-84,86-109`);
- core-dam pri každom nasadení: transport má len `topic` (`AnzuSystemsCoreDamExtension.php:534-552`), meno odberu
  je predvolene meno témy a oboje sa založí, ak chýba (`GPS/Transport/GpsConfigurationResolver.php:55-77`,
  `GPS/Transport/GpsTransport.php:74-94`). **Odvodené:** v produkcii existuje odber `notification_server_internal`
  bez konzumenta (supervisor ho nemá, `APP/docker/bin/messenger-supervisor-conf:4-19`), v ktorom sa hromadí každá
  notifikácia, kým ju Pub/Sub nezahodí po uplynutí retencie.

Záver: zastaviť službu je pre core-dam neškodné (publikovanie do témy bez odberateľa prejde). Zmazať tému, jej
právo alebo prístupové údaje pri zapnutom prepínači znamená zlyhávajúce súbory (riadky 1-4) a téma by sa pri ďalšom
nasadení core-dam aj tak znova vytvorila.

---

## 3. Poradie, predpoklady, overenie, odstránenie, návrat

### 3.1 Brány (frontend)

| Aplikácia | Je bránou? | Prečo |
|---|---|---|
| admin-dam | **áno, 3.0** (s knižnicou 2.0.0, `DAM/doc/changelog/3.0.0.md`, „Requirements") | verzia pred 3.0 so šablónou bez `uploadStatusFallback` zálohu nemá (1, bod 1; nasadenú verziu z kódu overiť nejde); 3.0 dopytuje vždy a štartuje aj bez bloku `notification` (`DAM/src/shared/EnvConfigService.ts:43-45`) |
| admin-ugc | nie | dnešný kód má službu natvrdo vypnutú (`UGC/src/main.ts:74-77`), žije zo zálohy |
| admin-cms | **len ak má v produkcii `DAM_NOTIFICATION_ENABLED=true`** | lokálne je `false` (`CMS/.env:28`), produkčná hodnota je v skupine premenných `admin-cms-<env>` (`CMS/azure-deploy-pipeline.yaml:26-27`). Pri `false` žije zo starej zálohy už dnes a vypnutie na backende ho nezmení. Pri `true` buď počkať na knižnicu 2.0 v CMS, alebo prijať starú zálohu (1, bod 2) |
| knižnica | 2.0.0 vydaná | predpoklad admin-dam 3.0 |

Medzi nasadením admin-dam 3.0 a krokom K3 nechať aspoň týždeň: karta otvorená pred nasadením beží so starým kódom
bez zálohy a starý admin-dam pri novej verzii len rozsvieti lištu, nenačíta sa sám (`DAM/doc/changelog/3.0.0.md`,
„The page reloads itself…").

### 3.2 Kroky

| Krok | Kto | Čo | Overiť pred ďalším | Návrat |
|---|---|---|---|---|
| K0 | vlastník, prevádzka | zistiť produkčné `DAM_NOTIFICATION_ENABLED` (admin-cms) a `NOTIFICATION_ENABLED` (admin-dam); vypísať odbery témy; spočítať v logoch core-dam chyby publikovania za posledné mesiace (3.3) | — | — |
| K1 | frontend | vydať knižnicu 2.0.0; nasadiť admin-dam 3.0 (dev, stage, prod); prijímací e2e „funguje bez služby" (`upload-plan.md:336-337`) | `appVersion` v `config.json` každej aplikácie; upload, slot, import, distribúcia, YouTube | nasadiť predošlú verziu (služba aj publikovanie bežia) |
| K2 | frontend, prevádzka | admin-dam `NOTIFICATION_ENABLED=false`; admin-cms `DAM_NOTIFICATION_ENABLED=false` (podľa 3.1); nové nasadenie (šablóna sa plní pri nasadení, `DAMDEPLOY/azure-deploy-pipeline.yaml:64`, `node-deploy-cfpages.yaml@templates`) | `config.json` nesie hodnotu iné než `true`; po týždni žiadne nové spojenia na `/ws` (3.3) | premenná späť a nasadiť |
| K3 | backend | `APP/config/packages/settings.php:59-63` na `'enabled' => false` (text v úlohe nižšie); CI; nasadiť dev, stage, prod (app, messenger aj cron pody) | po nasadení nulové publikovanie do témy; v logoch žiadna chyba Pub/Sub z notifikácií | revert a nasadiť; téma ešte žije, publikovanie hneď pokračuje |
| K4 | prevádzka | služba na 0 replík | nikto nehlási problém; jej odbery zaniknú samy po 24 h (`NS/src/pubsub/notification-pub-sub.ts:100-103`) | znova škálovať (tému aj odber si služba založí sama) |
| K5 | prevádzka, po ďalšom týždni | zmazať tému, zvyšné odbery, práva, k8s objekty služby, DNS, certifikát, pipeline a skupiny premenných **služby** (3.4); premenné frontendov **nie** | — | obnoviť všetko zmazané: tému, odbery, práva, účet, k8s objekty, DNS, certifikát, pipeline a premenné služby (z repozitára `Anzu/notification-server` a ručne); samotné škálovanie nestačí. Pre push navyše vrátiť K3 a K2 |
| K6 | backend, frontend | `APP/.env:131` (`MESSENGER_NOTIFICATION_TOPIC`); šablóna admin-dam bez bloku `notification`; kód a šablóna admin-cms tolerantné k chýbajúcemu bloku (tím admin-cms); lokálne stacky (3.4) | nové nasadenie oboch adminov prejde a `config.json` je platný JSON | vrátiť zmenu šablóny či kódu |
| K7 | prevádzka | až po K6 a nasadení: zmazať `NOTIFICATION_*` v `admin-dam-<env>` a `DAM_NOTIFICATION_*` v `admin-cms-<env>` | ďalšie nasadenie oboch adminov prejde | premenné vrátiť |

Poradie K2 pred K3 nie je nutné pre funkčnosť, len pre rýchlosť: s otvoreným, ale mlčiacim spojením beží knižnica
2.0 riedkym rytmom (prvé čítanie po 10 s, potom 30 s a 60 s, `uploadPollSchedule.ts:25-33`; režim podľa spojenia
`LIB/src/domains/dam/uploadQueue/settlement/uploadSettlement.ts:676`). Poradie K2 pred K4 nutné je: knižnica 2.0 so
zapnutou službou, ktorá neodpovedá, po piatich pokusoch ukáže upozornenie „notifikácie nie sú pripojené"
(`LIB/src/domains/dam/composables/damNotifications.ts:34-43`). K2 hneď po K1 má aj produktový dôvod: so zapnutými
notifikáciami platí okno nálezu 51 (51b, `upload-postup.md:170`), lebo riadok uploadu sa odomkne notifikáciou
o metadátach, kým spracovanie ešte beží; pri samotnom dopytovaní sa formulár otvorí až pri `processed` (R4).

### 3.3 Ako overiť, že nikto nepočúva

Kód služby nemá metriky ani log spojení na bežnej úrovni (`NS/src/server/websocket-server.ts:40-65`; loguje len
odmietnutý pôvod `:29` a neplatný token `:45`). Spoľahlivé znamenie je teda vstup do služby, nie Pub/Sub:

1. **Spojenia WebSocket**: prístupové logy alebo metriky ingressu či load balancera pre cestu `/ws`, odpoveď `101`,
   rozdelené podľa `Origin`. Cieľ po K2: nula okrem dobiehajúcich starých kariet. Ktorý ingress to je, z repozitárov
   nevidno.
2. **Nezapínať `LOG_LEVEL=debug`** v produkcii kvôli počítaniu: služba vtedy loguje celý JWT (`NS/src/util/user-token-verifier.ts:18`)
   a obsah každej správy (`NS/src/pubsub/notification-pub-sub.ts:48`).
3. **Pub/Sub, téma**: počet publikovaní do `notification_server_internal` (v Cloud Monitoring `topic/send_request_count`;
   meno metriky podľa mojej znalosti, neoverené). Po K3 nula, to dokazuje, že vypnutie prešlo do všetkých podov.
4. **Pub/Sub, odbery**: `gcloud pubsub topics list-subscriptions notification_server_internal`. Očakávané:
   `notification_server_internal_<APP_INSTANCE_NAME>` (jeden na pod služby) a `notification_server_internal`
   (core-dam, bez konzumenta, odvodené). Akýkoľvek iný odber je neznámy odberateľ; pred zmazaním ho dohľadať.
   Odbery služby ťahajú správy aj vtedy, keď nie je pripojený žiadny prehliadač, takže ich metriky o používateľoch
   nič nepovedia.
5. **Logy core-dam pred K3** (rozsah dnešnej väzby): `AssetFile (…) change state to (…) failed` s výnimkou Google
   (`AssetFileChangeStateHandler.php:102-110`), `Asset file (…) process failed reason (unknown)` (`AssetFileStatusManager.php:85-94`),
   `Post-delete cleanup failed` (`AssetFacade.php:152-156`). Po K3 by výnimky Google z notifikácií nemali byť žiadne.
6. **Konfigurácia aplikácií**: `config.json` každého adminu v každom prostredí (pozrie vlastník v prehliadači).

### 3.4 Čo odstrániť, čo nie

Nájdené v repozitároch:

| Kde | Čo | Kedy |
|---|---|---|
| core-dam | `config/packages/settings.php:59-63` → `['enabled' => false]`, **ostáva natrvalo** | K3 |
| core-dam | `.env:131` `MESSENGER_NOTIFICATION_TOPIC` (do k8s sa nedáva, `docker/kubernetes/configuration.yaml:147-156` ho nemá; v produkcii sa teda berie z `.env`, odvodené) | K6, nie skôr (návrat K3 ho potrebuje) |
| Pub/Sub | téma `notification_server_internal`; odbery `notification_server_internal_*` (služba) a `notification_server_internal` (core-dam, odvodené); práva viazané na tému a odbery; účet služby, ak má vlastný | K5 |
| nasadenie služby | v lokálnych repozitároch **nie je** (`NS/` má len `docker-compose*.yml` pre vývoj, žiadne k8s ani Terraform; Terraform som nenašiel v žiadnom repozitári). Nasadzuje ho repozitár `Anzu/notification-server` v Azure DevOps (`petit/tools/azure-cleanup-branches.yaml:133-135`): Deployment, Service, Ingress s cestou `/ws`, HPA, ConfigMap a Secret s premennými z `NS/.env.dist` (`PUBSUB_TOPIC`, `GCLOUD_PROJECT`, `APP_INSTANCE_NAME`, `WEBSOCKET_SERVER_PORT`, `WEBSOCKET_SERVER_CORS`, `SSO_JWT_COOKIES`, `SSO_JWT_ALGORITHM`, `SSO_JWT_PUBLIC_KEY`), DNS a certifikát hostiteľa WebSocketu, pipeline, skupiny premenných, image | K5 |
| admin-dam | blok `notification` v `DAMDEPLOY/public/config.json.cf.dist:19-22` (admin-dam 3.0 ho nepotrebuje); potom skupina `admin-dam-<env>`: `NOTIFICATION_ENABLED`, `NOTIFICATION_WEBSOCKET_URL` (kým ich šablóna menuje, musia ostať) | K2 hodnota, K6 blok, K7 premenné |
| admin-dam lokálne | `DAM/.env:7-8`, `DAM/.env.local:2`, `DAM/public/config.json.dist:17-20`, `DAM/docker-compose.yml:16`, `DAM/docker-compose.override.yml:20` | K6 |
| admin-cms | blok v `CMS/public/config.json.cf.dist:71-74` **zatiaľ nechať**: admin-cms ho číta bez `?.` (`CMS/src/shared/EnvConfigService.ts:186-187`) a bez neho by nenaštartoval. Premenné `DAM_NOTIFICATION_ENABLED`, `DAM_NOTIFICATION_WEBSOCKET_URL` v `admin-cms-<env>` ostávajú, kým sa nezmení kód **aj** šablóna: `enabled` je v šablóne bez úvodzoviek (`:72`), bez premennej by mohol vzniknúť neplatný JSON (odvodené) | K2 hodnota; K6 kód a šablóna (tím admin-cms); K7 premenné |
| admin-ugc | nič (služba v dnešnom kóde natvrdo vypnutá) | — |
| lokálny vývoj | `petit/tools/start.sh:9-10,56`, `petit/tools/.env.start.local:3`; `APP/.env.local` | K6 |

**Neodstraňovať:**
- `GOOGLE_PUBSUB_SA_KEY` (`APP/docker/kubernetes/configuration.yaml:240`): ten istý kľúč používajú všetky fronty
  messengera (`APP/config/packages/messenger.php:58-60`).
- `ANZU_NOTIFICATION_DOMAIN`, `ANZU_DAM_NOTIFICATION_API_TOKEN` (`configuration.yaml:21,217`, `APP/config/packages/clients.php:27-31`)
  a repozitár `petit/notification` s témou `notification_server`: iná služba (BE-analýza 9).
- Kód notifikácií v bundli: je pod prepínačom, iné inštalácie bundlu ho môžu používať.

---

## 4. Riziká a čo sa z kódu overiť nedá

Riziká:
1. **Vypnutie na backende pred admin-dam 3.0**: uploady v admin-dam ostanú „spracúva sa", distribúcie sa
   neobnovia, YouTube nepotvrdí. Brána K1, plus týždeň na staré karty.
2. **Zmazanie témy alebo práva pred K3**: súbory zlyhávajú (2.3, riadky 1-4) a nasadenie core-dam tému znova založí.
3. **Pasce zápisu prepínača** (2.1, bod 8): skratka `false`, env premenná, neskoršie „upratanie" bloku.
4. **Zámena** s druhou službou `notification` a so spoločným kľúčom Pub/Sub (3.4).
5. **Odstránenie bloku v šablóne admin-cms** zhodí štart admin-cms; **zmazanie premenných frontendov** pred zmenou
   šablón (a pri admin-cms aj kódu) môže pokaziť ďalšie nasadenie (K7 až po K6).
5b. **Návrat po K5** je drahý: obnovuje sa všetko zmazané, nielen počet replík.
6. **Dnešná väzba trvá do K3**: výpadok Pub/Sub alebo odobraté právo dnes zmení spracované súbory na zlyhané. Ak sa
   K3 odloží o mesiace, oplatí sa `try/catch` s logom v `AbstractNotificationDispatcher::notify()` (bod 8 v „Pre vlastníka").
7. **Produktové rozdiely po vypnutí** (všetky už rozhodnuté alebo na potvrdenie): formulár metadát až po spracovaní
   (R4), zmena práv až po načítaní stránky (`user_updated`), úspech prihlásenia do YouTube až po návrate do okna.
   Naopak, kým sú notifikácie v adminoch zapnuté, platí okno nálezu 51b (3.2, za tabuľkou).

Z kódu sa overiť nedá:
- produkčné hodnoty skupín premenných admin-cms a admin-dam; skutočne nasadená verzia admin-dam (1.28.0 je len údaj
  z `DAMDEPLOY/github.version`) a admin-cms;
- čo úloha nasadenia (`node-deploy-cfpages.yaml@templates`) urobí so zástupným znakom, ktorého premenná chýba;
- repozitár `Anzu/notification-server` (k8s, ingress, DNS, účet, práva); či existuje iný odberateľ témy;
- či odber `notification_server_internal` založený core-dam naozaj existuje a koľko v ňom leží;
- či publikovanie v produkcii už niekedy zlyhalo (logy, 3.3, bod 5);
- zostavenie kontajnera s vypnutým prepínačom (z čítania DI pravdepodobné, ukáže CI po K3), presný typ výnimky
  klienta pri 404;
- či dev a stage majú vlastný projekt GCP a vlastnú tému;
- mená metrík Cloud Monitoring.

---

## Pre vlastníka

1. Poradie K0 až K7 (admin-dam 3.0, hneď potom vypnúť službu v konfigurácii adminov, potom `enabled: false`
   v core-dam, potom zastaviť a zmazať službu a tému; premenné adminov až po zmene ich šablón a kódu): **áno**. Vlastný
   krok 4 plánu, mimo kroku 5; backend asi 0,5 h + nasadenia, prevádzka 2-4 h, šablóny a kód adminov asi 1 h (tímy
   admin-dam a admin-cms), plus dve týždňové čakania.
2. admin-ugc nie je bránou (dnešný kód službu natvrdo vypína): **potvrdiť**.
3. admin-cms: ak má v produkcii `DAM_NOTIFICATION_ENABLED=false`, na knižnicu 2.0 v CMS sa nečaká; ak `true`,
   vypnúť ju až s knižnicou 2.0. **Odporúčam tak**; hodnotu treba pozrieť v Azure (5 minút).
4. Len globálny prepínač, doslovné `false` v `settings.php`, postupne po prostrediach; prepínač pre externý systém
   nepoužiť: **áno**.
5. Medzi nasadením admin-dam 3.0 a vypnutím v core-dam aspoň týždeň (staré karty bez zálohy): **áno**.
6. `user_updated` bez náhrady (zmena práv v admin-dam sa prejaví po načítaní stránky): **prijať** podľa R5;
   voliteľne čítať používateľa pri návrate do okna, asi 1 h v admin-dam, kedykoľvek po kroku 5.
7. Nález 13 od služby nezávisí (backend neúspech prihlásenia neoznamuje ani so službou): **zavrieť bez zmeny**, ako
   už rozhodnuté, len opraviť jeho popis v denníku.
8. Ak sa krok K3 posunie o viac než pár týždňov: `try/catch` s logom v `notify()` v bundli, asi 1-2 h + vydanie
   bundlu. **Len pri odklade**, inak nie.
9. Repozitár `anzusystems/notification-server` archivovať mesiac po K5; WebSocket v knižnici a admin-dam nechať do
   ďalšej veľkej verzie knižnice: **áno**.
10. Text úlohy nižšie odovzdať tímu backendu a prevádzky: **áno**.

---

## Úloha pre backend a prevádzku (na vloženie)

**Vypnutie DAM notifikácií v core-dam a zrušenie notification-server**

Cieľ: core-dam prestane posielať notifikácie do Pub/Sub témy `notification_server_internal`, potom sa zruší
služba `notification-server` (WebSocket) a všetko, čo k nej patrí. Frontendy už notifikácie nepotrebujú: knižnica
`@anzusystems/common-admin` 2.0 a admin-dam 3.0 si stav uploadov, distribúcií a prihlásenia do YouTube zisťujú
dopytovaním.

Predpoklady (potvrdí frontend, nezačínať bez nich):
- admin-dam 3.0 je nasadený vo všetkých prostrediach aspoň týždeň;
- v admin-dam je `NOTIFICATION_ENABLED=false`, v admin-cms `DAM_NOTIFICATION_ENABLED=false` (alebo je admin-cms
  na knižnici 2.0); admin-ugc má službu v kóde vypnutú. Vypnutie v adminoch má prísť čo najskôr po nasadení
  admin-dam 3.0: kým sú notifikácie zapnuté, formulár uploadu sa odomkne notifikáciou o metadátach ešte počas
  spracovania a uloženie môže spracovanie prepísať (nález 51b).

Krok 1, backend (core-dam):
- `config/packages/settings.php`, blok `anzu_systems_core_dam.settings.notifications` (riadky 59-63):
  ```php
  'notifications' => [
      'enabled' => false,
  ],
  ```
- Musí to byť pole s doslovným `false`. Nie `'notifications' => false` (rozšírenie bundlu číta surovú konfiguráciu
  a tému s transportom by deklarovalo ďalej), nie cez env premennú, a blok sa neskôr nesmie zmazať (predvolene je
  zapnuté).
- Účinok: `AbstractNotificationDispatcher::notify()` sa vráti hneď, zmizne synchrónne volanie Pub/Sub pri každom
  prechode stavu súboru, distribúcie aj pri úprave používateľa; DI prestane deklarovať tému, pool
  `core_dam_bundle.pub_sub_token_cache` a transport `notification_server_internal`, takže ich
  `messenger:setup-transports` pri nasadení už nezakladá (skript `docker/bin/run-migrations` ho volá v jednotnom
  čísle `setup-transport`, Symfony skratku prijme).
- Kontrola: z čítania kódu by sa kontajner mal zostaviť, ale nespúšťali sme to; rozhodne CI (test prostredie bude
  po zmene prvýkrát bez poolu a transportu). Lokálne
  `bin/console debug:container core_dam_bundle.pub_sub_token_cache` nič nenájde a `debug:config framework messenger`
  nemá transport `notification_server_internal`. Záznam do changelogu core-dam.
- Nasadiť dev, stage, prod; nové pody pre app, messenger aj cron.
- Návrat: revert a nasadenie; téma ešte existuje, publikovanie hneď pokračuje.

Krok 2, overenie (týždeň po kroku 1):
- do témy `notification_server_internal` sa nepublikuje nič;
- v logoch core-dam žiadne výnimky Google Pub/Sub z notifikácií;
- na ingress služby (cesta `/ws`) už neprichádzajú spojenia (len dobiehajúce staré karty);
- `gcloud pubsub topics list-subscriptions notification_server_internal`: pošlite nám zoznam. Z kódu očakávame
  odbery služby `notification_server_internal_*` a odber `notification_server_internal` bez konzumenta, ktorý
  zakladal core-dam (či v produkcii naozaj existuje, z kódu nevidno); iný odber treba dohľadať pred mazaním.
- `LOG_LEVEL=debug` v službe nezapínať (loguje JWT a obsah správ).

Krok 3, prevádzka:
1. Služba na 0 replík. Návrat: znova škálovať (tému aj odber si založí sama).
2. O týždeň neskôr zmazať: tému `notification_server_internal`, všetky jej odbery, práva viazané na tému a odbery,
   účet služby (ak má vlastný), k8s objekty služby (Deployment, Service, Ingress, HPA, ConfigMap, Secret s
   `SSO_JWT_PUBLIC_KEY`), DNS a certifikát hostiteľa WebSocketu, pipeline a skupiny premenných repozitára
   `Anzu/notification-server`. Pred mazaním si zapísať, čo sa maže (hodnoty, manifesty, práva): návrat znamená
   obnoviť všetko zmazané, samotné škálovanie nestačí.
3. core-dam: zmazať `MESSENGER_NOTIFICATION_TOPIC` z `.env`.
4. Premenné adminov (`NOTIFICATION_*` v `admin-dam-<env>`, `DAM_NOTIFICATION_*` v `admin-cms-<env>`) až keď frontend
   potvrdí, že šablóna admin-dam nemá blok `notification` a admin-cms má zmenený kód aj šablónu, a obe aplikácie sú
   s tým nasadené. Dovtedy ich šablóny menujú; v admin-cms je `enabled` bez úvodzoviek a bez premennej by mohol
   vzniknúť neplatný `config.json`. Návrat: premenné vrátiť.

Nemazať:
- `GOOGLE_PUBSUB_SA_KEY` / `anzu-app-pubsub-sa`: používajú ho všetky fronty messengera core-dam;
- `ANZU_NOTIFICATION_DOMAIN`, `ANZU_DAM_NOTIFICATION_API_TOKEN` a tému `notification_server`: patria inej službe
  (`notification`);
- blok `dam.notification` v šablóne `config.json.cf.dist` admin-cms: bez neho admin-cms nenaštartuje (rieši tím
  admin-cms zmenou kódu aj šablóny);
- premenné adminov pred bodom 4 kroku 3;
- tému ani práva pred krokom 1: kým core-dam publikuje, zlyhané publikovanie zmení uložený alebo spracovaný súbor na
  `failed`, nechá súbor po dokončení uploadu v stave `uploaded` a zasekne distribúcie.

Pošlite nám späť: zoznam odberov témy, či dev a stage majú vlastnú tému, kde sa dá pozrieť počet spojení na `/ws`.
