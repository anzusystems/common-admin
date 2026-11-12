# Posudok plánu implementácie, verzia 3 (Opus, deep-reviewer, 9. 10.)

Prepísané z dvoch správ posudkového agenta. Bez BLOCKER; 1 WRONG, 1 GAP, 6 MINOR. Skripty spúšťal len na pokusných
stromoch v `scratchpad/review-v3-opus` (git nahradený, bez `mv`).

**Kontrola 1: nálezy verzie 2.** Codex v2: B1 (P0), B2 (N-C), B3 (prenos.sh) opravené; WRONG (možnosť B) opravené;
medzera snímok/záplata opravená okrem kódov zaplata.sh (MINOR 3); pripnutie zdroja kópie opravené; pamäťová brána
pred každým príkazom, pozri GAP 2. Opus v2: BLOCKER, WRONG, GAP 1, 2, 4, 5 a všetky MINOR opravené; GAP 3 okrem
MINOR 4. Dôvod vypustenia C0 platí (dist, src/eslint, src/vite a package.json zhodné s nainštalovanou kópiou;
sourcesContent dvoch .vue súborov zhodný s dnešnými). Počty v gite, HEAD, stash a cudzí worktree sedia s plánom.

**Kontrola 2: zmeny verzie 3.**
1. **WRONG:** plán:1039 dovoľuje vlastníkovi commit krokov 0 až 3 „kedykoľvek" a „plán funguje aj bez neho". Po S0
   ho commit rozbije: (a) každý cieľ kroku 5 už má necommitnuté úpravy krokov 0 až 3 (LIB `src/lib.ts`,
   `uploadService.ts`, `uploadQueuesStore.ts`, `UploadQueue(Item)Editable.vue`, `AnzuSystemsCommonAdmin.ts`,
   `publicExportsAdded.test.ts`; DAM `fileApi.ts`, `uploadQueuesStore.ts`, `uploadService.ts`), takže commit by
   vzal aj prácu kroku 5 alebo by potreboval staging po kúskoch; (b) commit posunie HEAD, snimok.sh ukladá
   `status --porcelain` a `diff HEAD` (:1162-1163) a navrat.sh ich porovnáva (:1243-1245): presná obnova staršej
   snímky by hlásila „nezhoduje" a zaplata.sh (:1191) by ukázal fantómové zmeny. Oprava: commit len pred prvou
   snímkou S0, inak až v Z.
2. **GAP:** kontrola swapu v bráne môže zablokovať každú CK, kým nezasiahne vlastník. `/tmp` (tmpfs) drží 5 779 MB,
   ale v pamäti je len 2,7 MB Shmem: pozostatky ležia v swape. SwapFree bolo 1,71 GB na začiatku posudku a 1,60 GB
   teraz, bez ťažkého behu; čakaním nestúpne. brana.sh chce aspoň 1 GB voľného swapu (:1118); kalibrácia prahy
   zvýši, ak sada v S0 klesne pod 1,5 GB (:796-798). Zvýšený prah potom brana.sh nesplní nikdy, každá CK a
   kopia.sh skončí kódom 76 a C1 sa neuzavrie. Upratanie `/tmp` je v :1038 „nie" (neblokuje) a v :84 len
   „odporúčané". Oprava: upratanie `/tmp` ako podmienka S0 a prah nikdy nad nečinné čítanie.
3. Iný nový spôsob, ako stratiť prácu, porušiť pravidlo alebo uviaznuť, nenašiel. Servery K-04 držia ZAMOK celý
   pohľad (:494,558), ostatné stromy len stoja (CK skončí 75 po 30 min); cyklus čakania nevzniká.

**Kontrola 3: skripty** (všetky prejdú `bash -n`; brana, vzorky, snimok, zaplata, navrat a prenos spustené na
pokusných stromoch).
3. **MINOR:** zaplata.sh (:1175,1182-1188): v git 2.53.0 `diff --no-index` vráti 1 aj pri „Could not access
   'path'" (chýbajúca cesta 1, nečitateľný súbor 128); chýbajúci menovaný súbor mimo `src` teda dá neúplnú
   záplatu s kódom 0. Oprava: `[ -e ]` na oboch stranách pred diffom.
4. **MINOR:** držiteľ zámku (:783-784,1014,1017): `fuser -v` aj `lsof` ukážu každý proces flock so súborom
   zámku, aj čakajúce; len FD „3rW" v lsof označí držiteľa. S `-o` je držiteľom obal flock, nie yarn, vitest ani
   Chromium; zabitie „držiteľa" uvoľní zámok, kým visiaci beh pokračuje. Oprava: `lslocks` (stĺpec BLOCKER) a
   `pstree -p <pid>`.
5. **MINOR:** poradie v S0 (:979-990, :710): bod 4 púšťa brana.sh a vzorky.sh do `vysledky/`, ale tie priečinky
   a skripty vzniknú až v bode 5 a skúška potvrdení až v bode 6; pevné okno vzoriek 3000 s môže skončiť pred sadou
   v lib-u v bode 7. Oprava: vzorky spustiť tesne pred tou CK.
6. **MINOR:** body porovnania P0 a I1 (:325,514-515,737): zaplata.sh prepisuje `zaplaty/U0-L.diff` voči živému
   lib-u, opakovanie po otvorení U1 by doňho dalo súbory U1; `snap/U1` zastará, ak sa U0-L robí znova (nový snímok
   by bol U1-o2) — porovnávať zmrazené snímky; pri I1 pravidlo RUCNE pokrýva len úpravy lib-u v súboroch U0-L,
   oprava dopredu v LIB (alebo K4, K5 v takom súbore) tiež dá RUCNE a `cmp` zlyhá bez pokynu. Pravidlo: vyhráva
   strana, ktorá sa líši od `snap/U1`.
7. **MINOR:** prostredie buildu nie je pripnuté (kopia.sh :1401; S0 :998). `yarn build` načíta devCopyToAdmins,
   ktorý sa uplatní pri `COMMON_ADMIN_COPY=types` (`scripts/vite/devCopyToAdmins.mts:71,82`) a vtedy skopíruje
   deklarácie do `COMMON_ADMIN_TARGETS` (:18-19), inak do cieľov `.env.local`, teda admin-cms a admin-ugc
   (`.env.local:2-6`). Dnes nie je nastavená ani jedna. Oprava: `env -u COMMON_ADMIN_COPY -u COMMON_ADMIN_TARGETS`.
8. **MINOR:** rozsah brány (:791 voči pravidlu 4 :855-858): `lint:tsc`, eslint, build a celé testy DAM, ktoré
   agenti púšťajú mimo skriptov CK, berú zámok, ale bránu nie.

**Overené a správne.** prenos.sh: triedy, `set -e` pri cp/mkdir, `cmp` po každej kópii. navrat.sh: nové položky
(vnorené priečinky, x vedľa x-b, `'` a medzera cez `%q`), kódy 2 a 3, `-zahodene` s časom pri opakovanom mene,
`cmp` menovaných súborov. kopia.sh: kontrola zdroja zodpovedá copy.sh, `2>&1`, presne jeden cieľ. Minimá vzoriek
sú čísla. `LC_ALL=C` sort a comm sa zhodujú. V žiadnom skripte nie je `cd`, `rm` ani `mv`. install-state.gz a
`.yarn-state.yml` nemajú absolútne cesty; self-link relatívny. LIB `src` nemá ignorovaný súbor; jediný prázdny
priečinok je `src/test/scratch`.

**Kontrola 4: kritická cesta** bez nálezov: 54,75 h, súčet 92,5 h, M1 až M8 sedia; závislosti zodpovedajú
návrhom (U2 až U5 po K6, `ttsAudio` s kópiou U1 v C2, rozdelenie U8, K-04 po U3/U5c/U6, F po K6).

**Verdikt:** plán je vykonateľný po oprave WRONG 1 (jeden riadok v časti 7) a GAP 2 (upratanie `/tmp` ako podmienka
S0); MINOR 3 až 8 sú drobné úpravy. Neoverené: čokoľvek, čo potrebuje skutočný beh (sada v lib-u, ohýbanie v
pamäti, výzvy na potvrdenie).
