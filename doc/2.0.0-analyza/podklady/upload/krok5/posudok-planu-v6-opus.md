# Posudok plánu implementácie, verzia 6 (Opus, deep-reviewer, úzky, 9. 10.)

Prepísané z dvoch správ posudkového agenta. 0 BLOCKER, 1 WRONG, 1 GAP, 2 MINOR; ostatné nálezy verzie 5 oboch posudkov
sú opravené.

- **WRONG, Z bod 8, kontrola (c), plán 716-721 (aj 36, 590-593):** (c) zlyhá na plánovanej ceste, hoci nič neostalo
  neprenesené. `I1-prenesene.txt` je posledný suchý beh I1, má len riadky RUCNE (`lib.ts`, `publicExportsAdded`).
  Neskoršia úprava v LIB súboru, ktorý `lib-u` zmenil, je v Z nové RUCNE; U8-L ho urobí vždy (mení
  `AssetQueueSelectedSidebar.vue`, 690, ktorý U4 zmenil v `lib-u`, 525), rovnako nálezy 20/36/45 alebo PV15 nad
  súbormi U7 a každý krok C4 v LIB. Pokus s `prenos.sh` z plánu: druhý suchý beh I1 dal `RUCNE lib.ts`, po úprave
  ako v U8-L pridal beh v Z `RUCNE …/AssetQueueSelectedSidebar.vue`, takže „(a) až (c) nesedia". (a) a (b) už
  dokazujú, že `lib-u` sa od I1 nezmenil, a druhý suchý beh I1 dokázal prenos. Oprava: (c) vypustiť, alebo
  pripustiť RUCNE pre cesty, ktoré boli VZIAT/NOVY v `zaplaty/I1-triedy.txt`.
- **GAP, odchod zo stavu `nejasne`, plán 33, 309-310, 1609-1614 (WRONG 4 Codexu v5 stále dosiahnuteľný):** `--stav`
  porovná len bod (1612), takže `<bod> nejasne`, potom CK-DAM, potom `--stav <bod> zelene` prejde, ako predpisuje
  riadok 33. Zelené CK-DAM nedokazuje, že je nainštalovaná knižnica toho bodu: CK-DAM v C1 beží nad nezmeneným
  kódom DAM (202, 578) a je zelené aj so starou knižnicou. Pokus: copy.sh skončí 0 a menuje iný cieľ → `C1 nejasne`;
  `--stav C1 zelene` → 0; ďalší `kopia.sh C2` zapíše `C2 C1 zelene`, hoci drží balík S0; `obnova-balika.sh` ho potom
  vráti ako `C1 obnovene`. Ani 5.1 (1066-1070), ani 6 (1162) nehovorí, čo nasleduje po `nejasne`. Oprava: `--stav`
  prijať len zo stavu `neoverene` alebo `obnovene`; po `nejasne` znova `kopia.sh <bod>` alebo `obnova-balika.sh`.
  Dosiahnuteľné len pri odchýlke výstupu copy.sh, čo dnes pri jednom výslovnom cieli a `set -euo pipefail` nenastane;
  je to však ten istý predpoklad, proti ktorému chráni Z-2.
- **MINOR, 75 voči 76, plán 32 a 886-887 voči 1316-1319:** po neprejdenej bráne vráti vypršané čakanie na zámok 75
  (`exit "$rc"`, 1318) a rovnako značka `cas` (1319); text hovorí 76 vždy, keď brána neprešla. Pokus: brána raz
  neprejde, iný proces drží zámok 30 s, `-w 25` → 75 po 25 s, príkaz nebežal. Oba kódy znamenajú „skús znova", rozdiel
  je len v riadku časti 6 (1161 voči 1165). Oprava: text, alebo 76 pri `brana_neprisla=1`.
- **MINOR, základ kontroly (b), plán 717-718:** zmeny mimo `src` urobené v `lib-u` pred I1 sú zmrazené v
  `snap/I1-lib-u/status.txt`, takže ich (b) neoznačí. `prenos.sh` prenáša len `src`, I1 porovná `cmp` deväť súborov
  v koreni (810, 860) a `zaplata.sh` skrýva `doc/` (1398, 258-259). Súbor zapísaný pod `lib-u/doc/` (nesledovaný
  strom doc LIB z tar v S0, 794-795) teda prejde (a) až (c) a `--force` ho odstráni. Nepravdepodobné (pravidlo 8 dáva
  cestu v hlavnom strome). Oprava: porovnať riadky mimo `src` so `snap/U0-L/status.txt`.

**Overené bez nálezov.** Celý plán, oba posudky v5 a copy.sh. Všetkých 11 skriptov (zhodných s `plan-v6-kontrola`):
`bash -n` prejde, žiadny rm, rmdir ani cd, mv len ako vypísaný text v navrat.sh. Pokusné behy v
`scratchpad/review-v6-opus/` (presmerované cesty, falošný yarn, git a copy.sh): tezky.sh prepustí kódy 0/7/75/76/199
po jednom behu, v oboch režimoch odstráni `COMMON_ADMIN_*` a nastaví `KROK5_TEZKY=1`; vnorené `-w 1800` beží hneď
aj pri zámku drženom inde; držaný zámok → 75 po 5 s bez behu; brána nikdy neprejde pri `-w 20` → 76 po 15 s, zámok
počas čakania voľný; brána prejde na druhý pokus → jeden beh s vlastným kódom. Obalený ck-lib.sh aj kopia.sh → 0.
Značky `tezky-$$` sa nemôžu zraziť (bez menného priestoru PID). Cesty v kopia.sh a navrat.sh jedinečné pri troch
behoch v jednej sekunde, bez vnorenia; `rsync --checksum` obnoví úpravu s rovnakou veľkosťou a časom. Obnova odmietne
`nejasne` predvolene aj menovite. Z-3, Z-5 a Z-6 konzistentné v 1.3, 2.0, 2.6, 2.8, 5.3 a 7. Z-7: plán 1099 je bajt po
bajte zhodný s denníkom 871 a pgrep nenájde sám seba; copy.sh:103-105 sedí. Nespúšťané: nič v repozitároch, skutočný
git.
