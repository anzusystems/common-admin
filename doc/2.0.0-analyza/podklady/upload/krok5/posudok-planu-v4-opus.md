# Posudok plánu implementácie, verzia 4 (Opus, deep-reviewer, úzky, 9. 10.)

Prepísané z dvoch správ posudkového agenta. 0 BLOCKER, 1 WRONG, 1 GAP, 3 MINOR; všetkých 14 nálezov verzie 3 je
v podstate opravených (Codex: navrat.sh, N-K, prítomnosť vlastníka, brána pri cielených behoch, C4, P0; Opus: commit,
`/tmp`, MINOR 3 až 8). Ostáva C4 po Z (GAP nižšie) a kritérium `/tmp` (tretí MINOR).

- **WRONG, 3.6:836-837:** `kopia.sh` je medzi príkazmi, ktoré idú „cez tezky.sh", a obalenie uviazne samo na sebe.
  kopia.sh už volá tezky.sh sám (1511, 1514) a 2.6:545 ho púšťa holý. Pri obalení drží vonkajší flock ZAMOK (`-o`
  len skryje deskriptor pred potomkom), vnútorný flock čaká celých `-w 1800` a skončí 75 („skús neskôr"); každý
  ďalší pokus rovnako po 30 min a uloží ďalšiu 15 MB kópiu balíka. Pokus: vonkajší tezky.sh okolo skriptu, ktorý
  volá tezky.sh `-w 3`, vráti 75 po 3 s. To isté, ak agent obalí ck-lib.sh alebo ck-dam.sh podľa pravidla 4
  (915-916). Oprava: výslovne, že kopia.sh a skripty CK sa nikdy neobaľujú, alebo poistka vnorenia v tezky.sh
  (exportovaná značka; ak je nastavená, `exec "$@"` bez brány a zámku).
- **GAP, Z:662-668: PRACA sa zmaže skôr, než ju prestane treba.** Jeden príkaz vlastníka (U9a) zmaže PRACA s
  nastroje, zamok.lock, balik, snap a wt/lib-u. Potom (a) „po zmazaní znova ck-dam.sh" (668) nemá skript ani zámok;
  (b) vetva X-7 po Z (186, 581: C4, potom CK oboch stromov a register) potrebuje kopia.sh, ck-*.sh a tezky.sh;
  (c) wt/lib-u je v PRACA, takže zmazanie PRACA pred `git worktree remove` nechá záznam „prunable" (ako dnes
  common-admin-main-sync) a prune je zakázaný (666-667). Oprava: PRACA zmazať posledná, po poslednej CK, každej C4
  a odstránení worktree. C4 po Z potrebuje aj nový beh e2e a znova rozhodnutie o commite.
- **MINOR, 1506-1507/1517 voči 2.0:285:** rada N-K môže menovať zlú zálohu. kopia.sh vypíše najnovšiu, 2.0 hovorí
  `<bod>`. Na ceste N-C podľa plánu (279-281: N-H, potom znova kopia.sh) je najnovšia záloha práve tá knižnica,
  ktorá zlyhala v CK-DAM, a jej obnova nechá CK-DAM-T (288) červené. Správne: obnoviť najnovšiu zálohu, ktorej
  CK-DAM bolo zelené.
- **MINOR, 2.9:687:** K2-D4 hovorí „DAM ju nepotrebuje" (bez kópie), čo odporuje 2.9:679 („kópiu potrebuje vždy,
  keď mení LIB"), 0:100-101 a 7:1126 („po C3 s vlastnou C4").
- **MINOR, 5.3:1031-1032:** kritérium pre `/tmp` zachytí aj priečinok VS Code. `/tmp` má 220 položiek s 21-znakovým
  menom; 220. je `/tmp/vscode-typescript1000` (prázdny, teraz ho nikto nemá otvorený). Kritérium denníka (len
  s `client` alebo `ssr` vnútri) ho vylúči a dá 219 priečinkov, 4 438 MB. Dať ho do 5.3.

**Overené bez ďalších nálezov.** X-1 až X-9 sú zapracované konzistentne v 0, 1.1-1.3, 2.0, 2.1, 2.6, 2.9, 3.2, 3.4,
3.6, 3.7, 4.2 pravidlo 4, 5.1, 5.3, 6, 7 a v prílohe; nezostal fuser, lsof ani „U1 otvorený". Pravidlo vlastníka
(denník :227) je len „kódovanie sa nezačne bez vlastníka", takže predvolenie X-5 mu vyhovuje. Všetkých 11 skriptov
prejde `bash -n`; žiadny nemá rm, rmdir, cd ani mazanie; mv je len text, ktorý vypíše navrat.sh; git len na čítanie.
Pokusné behy (falošný git, yarn a copy.sh): tezky.sh vráti vlastný kód príkazu (7), 75 pri držanom zámku, 76 pri
neprejdenej bráne, odstráni `COMMON_ADMIN_*` a zvyšok prostredia nechá, potomok nemá deskriptor zámku, zlyhaný exec
flocku dá 69 (CK ho počíta ako červené). lslocks ukáže držiteľa s prázdnym BLOCKER a čakajúceho ako WRITE* s PID
držiteľa; pstree ukáže flock---potomok. navrat.sh: bez src, prázdny alebo nezhodný subory.txt, nečitateľný priečinok
alebo bez HOTOVO → kód 1 a žiadne mv; nové položky (vnorené, x-b, `'` a medzera) → 3; obnova s menovanými súbormi
aj bez nich vrátane kolízie -zahodene → 0. zaplata.sh: chýbajúci menovaný súbor → 1. kopia.sh: záloha, časová
prípona, COMMON_ADMIN_PROJECT sa k copy.sh nedostane, 75 prejde pod `set -e`, presná rada. obnova-balika.sh: obnova,
cmp, NAVYSE, chýbajúca záloha → 1. vzorky.sh: minimá sú čísla. copy.sh (98-121) maže presne štyri časti balíka,
ktoré obnova-balika.sh vracia, plus cache. devCopyToAdmins sa uplatní len pri watch alebo `COMMON_ADMIN_COPY=types`
z process.env; `.env.local` nastavuje len `COMMON_ADMIN_PROJECT` a `ADMIN_PROJECTS`. Počty v gite, HEAD, časy v src,
cudzí worktree a SwapFree (1,57 GB) sedia s plánom. Neoverené: čokoľvek, čo potrebuje skutočný beh.
