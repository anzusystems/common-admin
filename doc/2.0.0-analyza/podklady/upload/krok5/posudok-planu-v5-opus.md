# Posudok plánu implementácie, verzia 5 (Opus, deep-reviewer, úzky, 9. 10.)

Prepísané z dvoch správ posudkového agenta. 0 BLOCKER, 1 WRONG, 0 GAP, 5 MINOR. Všetkých 9 nálezov verzie 4 je
riešených; výnimkou je WRONG o vnorení: text je opravený (3.6:861-863, 4.2:951, 1248, 1544), poistka nefunguje.

- **WRONG, 3.6:862-863, príloha 1253-1254 (Y-1):** poistka beží pred spracovaním `-w`. Prípad, pre ktorý existuje,
  sú kopia.sh a ck-*.sh, a tie volajú vždy `tezky.sh -w 1800` (1494, 1525, 1575, 1578), takže poistka spustí
  `env -u … -w 1800 <príkaz>`; env `-w` odmietne s kódom 125. Pokus: vnorené volanie bez `-w` prejde, s `-w 1800`
  zlyhá („unexpected argument '-w'", 125). Obalený pokusný ck-lib.sh nespustil nič, pri všetkých šiestich krokoch
  vypísal „!! zlyhalo (kód 125)" a „CK-LIB-T: ČERVENÉ" (falošné červené, nie 75). Obalený kopia.sh uložil balík,
  pridal riadok do zoznamu a skončil 125 bez zmeny DAM. Oprava: `if [ "${1:-}" = -w ]; then shift 2; fi` v poistke
  pred `exec`.
- **MINOR, 5.3:1067 (Y-8):** v neinteraktívnom shelli príkaz nájde sám seba. Nástroj Bash spúšťa `/bin/bash -c "…
  eval '<príkaz>'"`; ten príkazový riadok obsahuje text hlásenia „beží vitest…", ktorý `[v]itest` zachytí. Samotná
  časť pgrep bez bežiaceho vitestu vypísala len vlastný obal a „beží vitest alebo vite, nič nemažem". Nič sa nezmaže,
  ale podmienka S0 sa takto nesplní. Oprava: text hlásenia bez „vitest" a „vite ". Výber je správny: suchý beh dá 219
  priečinkov, 4 335 MB, `/tmp/vscode-typescript1000` vylúčený.
- **MINOR, 1.3:192 (Y-3):** pri C4 po Z 1.3 stále opakuje len „CK oboch stromov a register", chýba e2e a rozhodnutie
  o commite, ktoré majú 2.6:599-600, Z bod 7 (691-692) a 7:1172.
- **MINOR, 5.3:1105-1109 a 2.6:601:** kopia.sh odmietne beh bez `balik/nainstalovane.txt` (1564); plán ten súbor
  zapíše len v S0 bod 11, ktorý beží len „ak bod 2 nič nevypísal"; druhá vetva (1078) ho nezapíše nikdy a ani znova
  založená PRACA po zmazaní (601) nemá pokyn. Bezpečné (kopia.sh sa len zastaví), ale treba menovať riadok na zápis.
- **MINOR, Z:686 voči navrat.sh 1383-1388:** po prvom zmazaní vlastníkom (bod 4) sa N-H s ktoroukoľvek snímkou DAM
  spred neho (C3 alebo Z-dam z bodu 2, 681) zastaví s kódom 2 „porušenie pravidla" a poradí skopírovať zmazané
  súbory zo snímky späť, čím by zrušil zmazanie vlastníka. e2e (bod 6) beží až potom. Z má povedať, že po bode 4 sa
  DAM opravuje len dopredu; snímky C4 urobené neskôr sú v poriadku.
- **MINOR, 1264-1268:** neprejdenú bránu hlási kód 199; príkaz, ktorý sám skončí 199, sa teda spúšťa znova, kým
  nevyprší `-w`, a potom je hlásený ako 76. Pokus: 3 behy za 20 s, potom „BRÁNA neprešla". Pri yarn a copy.sh (0
  alebo 1) nepravdepodobné; presné by bolo značkovým súborom namiesto kódu.

**Overené bez nálezov.** Y-2: pri neprejdenej bráne je zámok počas 15 s čakania voľný (`flock -n` ho získal) a skript
skončí 76 po `-w`; pri zámku drženom inde 75 po 2 s; vlastný kód príkazu prejde (7); `COMMON_ADMIN_*` odstránené,
`KROK5_TEZKY=1` nastavené. Y-4: pokus S0 → C1 (zelené) → C2 (červené) → C2 znova so zlyhaným copy.sh; obnova vybrala
C2, vrátila knižnicu C1, vypísala NAVYSE a zapísala „C1 obnovene"; zlý bod odmietnutý. Y-5: package.json pevne
prepojený na súbor „úložiska" ostal nedotknutý; prepojený súbor odlišný od zálohy dal NEZHODA, kód 1. Skutočný balík
DAM (nodeLinker node-modules) nemá súbor s viac odkazmi ani symbolické odkazy; dist/src/eslint/src/vite majú
2212/8/5 súborov. Y-6: očakávaný a skutočný zoznam P0 zhodné; keď LIB zmenila aj súbor U0-L, diff ukázal VZIAT →
RUCNE. Y-3 poradie, Y-7 a znenie v 3.6, 3.7, 4.2 pravidlo 4, 5.1, 6 a 7 konzistentné. copy.sh: rm dist, rm a cp
package.json, cp dist, rm a cp eslint a vite (98-117); obnova pokryje zlyhanie v každom kroku. Citácia plánu
copy.sh:101-103 je v skutočnosti 103-105. Všetkých 11 skriptov prejde `bash -n`, žiadny nemá rm, rmdir ani cd, mv len
ako vypísaný text v navrat.sh. Nespúšťané: čokoľvek v repozitároch, kopia.sh pod časovým limitom nástroja Bash,
`git worktree remove` nad chýbajúcim priečinkom.

Poznámka vedúceho: príkaz na upratanie `/tmp` v denníku je opravený (text hlásenia bez hľadaného slova) a overený.
