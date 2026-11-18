# Posudok plánu implementácie, verzia 2 (Opus, deep-reviewer, 9. 10.)

Prepísané z dvoch správ posudkového agenta. Počas posudku prešli návrhy na verzie 4.3 (komponenty, 03:13) a 10.3
(jadro, 03:16); plán (00:43) cituje 4.1 a 10/10.1.

**1. Nálezy verzie 1.** Opravené: Codex B1, B2, B4 (= Opus W5), B5 (súhlas s copy.sh vo V0), W C2b, G8; Opus B2 pre
I1, W3, W4, W6, G7, G8, M9, M10, M11. Ostáva: Codex G7 a Opus B1/B2 sa vracajú cez P0 (BLOCKER nižšie); Codex B3:
navrat.sh obnoví `src` a menované súbory presne, ale nahradený nainštalovaný `dist` sa nedrží (GAP 2); Codex G9:
brána pribudla, ale `/tmp` má stále prah 1 GB a swap sa nekontroluje (teraz 6,6 z 8 GB).

**2. Nové nálezy.**

- **BLOCKER: P0 nevie oddeliť U0-L.** Tabuľka 1.1 púšťa P0 „súbežne s U1" (plan:90-91) na prvej hranici LIB po K2
  (plan:284); podľa odhadov plánu je U1 otvorený od 4,5 do 9,25 h a K2 sa uzavrie o 8,75 h. P0 púšťa prenos.sh nad
  živým `lib-u/src` (plan:286) a vyžaduje „len cesty U0-L … nič RUCNE" (plan:287-288). prenos.sh filter ciest nemá
  (plan:1129-1145), takže každá úprava U1 vyjde ako VZIAT/NOVY; `src/lib.ts` a publicExportsAdded (K1a aj U1) vyjdú
  ako RUCNE aj po uzavretí U1. 3.4 bod 1 vyžaduje `lib-u` na hranici (plan:697), čo tabuľke 1.1 odporuje. Buď K5
  stojí (potrebuje P0, plan:350), alebo `--vykonaj` prenesie polovičný U1 do LIB, C1 ho zabuduje do DAM a I1 dostane
  RUCNE pri každom súbore U1. Oprava: P0 podá ako worktree `snap/U1/src` (stav `lib-u` presne po U0-L, plan:182).
- **WRONG: predpoklad C0 neplatí** (plan:44,145,247-249). Knižnica nainštalovaná v DAM je bajt po bajte zhodná s
  `dist` LIB (`diff -rq` kód 0; aj `src/eslint`, `src/vite`, `package.json`). Ten `dist` je postavený z dnešného
  obsahu: `sourcesContent` v mapách `UploadQueueEditable.js.map` a `UploadQueueDialogSingleSidebar.vue_vue_type_script_setup_true_lang.js.map`
  sa zhoduje s dnešnými súbormi (4 985 a 6 557 znakov). Časy 18:44:13 a 18:46:03 nenesú zmenu obsahu. C0 pridáva
  bránu vlastníka, `rm -rf` z copy.sh a CK-DAM zbytočne; aj jeho výklad „červené C0 = zmena z 18:46 zlomila DAM" je
  zlý. Nechať C0 len ako ohlásenú skúšku kopia.sh, alebo ho vypustiť.
- **GAP 1: N-H stratí prácu kroku.** navrat.sh prepíše každý zmenený súbor (`rsync`, plan:1108) a nič si nenechá;
  do koša idú len nové súbory. Ostane len posledná záplata, ktorej hlavičky majú dve rôzne absolútne cesty
  (plan:1076), takže ju `git apply` tak, ako je, nevráti. Oprava: navrat.sh najprv skopíruje `"$T/src"` do
  `snap/<K>-zahodene`.
- **GAP 2: N-C narazí na otvorený krok LIB.** K4 sa otvorí po časti LIB v C1, pred jeho CK-DAM (plan:94,133,463);
  U6 po časti LIB v C2 (plan:102). Červené CK-DAM spustí N-C, definovaný ako „N-H kroku v LIB" (plan:219,952), kým je
  K4 alebo U6 otvorený; navrat.sh K2 by nové súbory K4 vypísal ako súbory K2 a prepísal úpravy K4. Oprava: pred
  každým kopia.sh `cp -a` nainštalovaného balíka (15 MB) do PRACA, alebo otvoriť K4/U6 až po CK-DAM kópie.
- **GAP 3: flock** (plan:39,720-726,942). (a) Bez `-o` dedí deskriptor zámku yarn, node, vitest aj Chromium; jeden
  osirelý proces drží zámok donekonečna a „ps s flock a yarn" (plan:942) ho nenájde. Použiť `flock -o`, držiteľov
  hľadať `fuser -v` alebo `lsof`. (b) Čas `-w` vyprší s kódom 1 a krok() ho počíta ako zlyhanú kontrolu
  (plan:1172,1199): čakanie nad 500 s vypíše „ČERVENÉ", napríklad za serverom pohľadu K-04 (plan:454,514). Použiť
  `-E 75` a 75 brať ako „skús neskôr". (c) Pravidlo 4 (plan:792-795) púšťa cielené testy v popredí, kde môžu čakať
  na zámok až 500 s, ale nástroj Bash agentov má predvolený časový limit 120 s.
- **GAP 4: plán zaostáva za návrhmi.** PV16 (jadro :51, :1521) nie je v 2.9 ani v časti 7. U6 stále menuje ZK26 a
  pohľad K-04 na panel „Info o súbore" (plan:446,452,975), hoci komponenty 4.3 ZK26 vyradili (pohľad po U6 len ZK23).
- **GAP 5: odložený pohľad K-04** (plan:227-230) nemá pravidlo času. Dev server aj ihrisko ukazujú živý strom
  (plan:454,514), takže po otvorení ďalšieho kroku by vlastník videl jeho rozpracované úpravy. Odložené pohľady len
  na hranici stromu.

**MINOR.**
- Overenie v S0 zlyhá: LIB `src/test/scratch` je prázdny priečinok (od 10. 9.), ktorý git nevidí, takže `lib-u` ho
  nemá a `diff -rq` (plan:652) vypíše „Only in …/common-admin/src/test: scratch"; podľa plan:649 sa potom `lib-u`
  zahodí (+20 h). Priečinok v `lib-u` vytvoriť.
- kopia.sh: copy.sh píše chyby na stdout (copy.sh:15-86); pod `set -euo pipefail` zlyhané `out=$(…)` (plan:1223)
  skončí pred `echo "$out"` (plan:1224), ticho, možno po tom, čo copy.sh:98 zmazal `dist`. Použiť
  `out=$(… 2>&1) || { echo "$out"; exit 1; }`.
- `lib-u` nemá `.yarn/install-state.gz` (gitignorovaný, LIB `.gitignore:17`; záplata, tar ani rsync `node_modules`
  ho neprenesú). Yarn 4.18.0 pri `run` volá `restoreInstallState()` a linker bez neho hodí „doesn't seem to have
  been installed". Súbor nemá absolútne cesty LIB, stačí ho skopírovať, bez `yarn install`. Nespúšťané.
- snimok.sh: zlyhanie po `mkdir` (plan:1050) nechá čiastočný snímok, ktorý meno zablokuje navždy (plan:1049), lebo
  ho nikto nesmie zmazať; žiadne pravidlo mien pre opakovanie po N-H.
- navrat.sh overuje len `src` a menované súbory (plan:1111); zmena nemenovaného súboru mimo `src` prežije N-H
  ohlásený ako „zhodný". Porovnať `git status` so `status.txt` ako zaplata.sh. „Žiadny nemaže" (plan:47,1027) je
  doslova nepravda pre kopia.sh (`rm -rf` v copy.sh; vite vyprázdni `dist`) a ck-dam.sh (`generate:dts` volá
  `rmSync`, DAM `scripts/generate-dts.mjs:12-15`, cieľové súbory dnes neexistujú).

**3. Overené a správne.** Jeden otvorený krok v strome platí v 1.1, 1.2, 1.4, 2.x a 3.x okrem P0; C0 až C3, P0 a
I1 zapisujú len do stromov na hranici. prenos.sh pokrýva každý prípad (nezmenený, VZIAT, rovnaký v oboch, RUCNE,
NOVY, nový v oboch, ZMAZANE). navrat.sh: kódy 0/1/2/3 a úvodzovky v poriadku pre tieto cesty, menované súbory sa
obnovia. Kód 1 z `diff` a `git diff --no-index` nikdy nenarazí na `set -e`; žiadny skript nepoužíva `cd`. kopia.sh
môže cieliť len admin-dam (D pevné, argumenty majú prednosť pred `.env.local`, riadok úspechu sedí); `yarn build`
nepoužije devCopyToAdmins. Yarn 4.18.0 berie `--cwd` ako prvý argument; vitest 5.0.1 píše snímky zlyhaní do
`.vitest/attachments` (gitignorované). Build DAM posiela do Sentry len s `APP_DEPLOY_ENV` a `SENTRY_URL`. Kópie
sedia s komponentmi 2.11; rozdelenie U8-L/U8-D konzistentné; U7 pred U6 a U6 v LIB po C2 návrh dovoľuje
(komponenty :987). Kritická cesta 54,75 h.

**Neoverené.** Či `mv` alebo `bash <skript>` vypýta potvrdenie; ohýbanie v pamäti v režime prehliadača LIB; či
funguje pohľad K-04 v ihrisku (potrebuje bežiaci core-dam na `core-dam.sme.localhost`, `src/playground/mock/coreDamClient.ts:10`).

Poznámka vedúceho: posudok uvádza stav gitu „93 (54/39) a 62 (26/36)"; o 03:25 je `git status --short` LIB 100
riadkov (55 M, 45 ??) a DAM 66 (30, 36), zhodne s plánom, a v `src` sa od 18:50 nič nezmenilo.
