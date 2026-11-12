# M-A: merač mlčí, keď kúsok na ceste stojí

Rozhodnutie vlastníka 11. 10. (možnosť A z `impl/M.md`, „Na vedomie vlastníkovi", bod 2; register Z28). Strom LIB,
snímky `M-A`, `M-A-c1` a `M-A-c2`, záplaty `zaplaty/M-A.diff` (celý krok), `M-A-c1.diff` a `M-A-c2.diff` (cykly).
Robil vedúci.

## Čo sa mení v kóde

- `src/domains/dam/uploadQueue/composables/uploadMeter.ts`: tik hlási, len keď platí aspoň jedno:
  - **pribudli bajty** od predošlého hlásenia (príznak `moved`: nastaví ho bod krivky s viac bajtmi než predošlý,
    zhodí ho hlásenie);
  - **čaká sa na odpoveď servera** ku kúsku, ktorý je celý na ceste (`answerAwaited()`: pokus beží a krivka je na
    jeho konci, `current.end`);
  - **posielanie je hotové** (`sendingOver`: posledné hlásenie „100 %, 0 s" ostáva, ako bolo).

  Jediná zmena samotnej krivky: udalosť s `loaded >= total` dá na krivku celý kúsok bez delenia (cyklus 2, bod 1).
- `src/domains/dam/uploadQueue/__tests__/uploadMeter.test.ts`: prípad „slows down while nothing is sent" nahradili
  šiestimi: spomalenie (bajty idú, ale menej), ticho uprostred kúska (jediné hlásenie; po ďalších bajtoch ráta okno aj
  ticho), čakanie na odpoveď servera (rýchlosť klesá každú sekundu), kúsok nad 95 MB je celý na ceste, keď je vonku
  celé telo, ticho medzi odpoveďou a ďalšou požiadavkou, a posledné hlásenie celého súboru, keď posledné bajty už boli
  ohlásené pred odpoveďou.
- `src/AnzuSystemsCommonAdmin.ts:68-72`: len komentár (známy dlh z PV14b: z `default` číta už len sklad mien autorov).

## Čo sa mení pre používateľa

admin-cms, admin-ugc, admin-dam (po kópii C4):

1. **Tok dát sa zastaví uprostred kúska.** Riadok drží poslednú rýchlosť a zvyšný čas, kým neprídu ďalšie bajty. Po
   kroku M rýchlosť každú sekundu ticha klesala a zvyšný čas rástol k hodinám.
2. **Veľkosť ďalšieho kúska po takom zastavení.** `updateChunkSize(queueItem.progress.speed)`
   (`uploadService.ts:133,176`) číta posledné hlásenie. Keď pokus po tichu zlyhá (lehota), opakovanie sa veľkosťou
   riadi rýchlosťou spred ticha, nie rýchlosťou stlačenou tichom (po kroku M klesla veľkosť z 50 MB na 1 až 1,5 MB).
   Ak sa linka vrátila pomalšia, opakovanie hlási svoju rýchlosť a kúsok sa zmenší pri ďalšom zlyhaní: jeden zo
   štyroch pokusov navyše.
3. **Bajty po tichu prídu znova.** Prvé hlásenie ráta okno 10 s aj s tichom, takže rýchlosť je chvíľu nižšia a kúsok,
   ktorý sa končí krátko po tichu, dá menší ďalší kúsok, ako po kroku M. Výnimka: ak sa kúsok po tichu skončí skôr,
   než príde ďalší tik, hlásenie po tichu nepríde a ďalší kúsok sa riadi rýchlosťou spred ticha (väčší než po kroku
   M).
4. **Spomalenie** (bajty idú, ale menej): rýchlosť klesá ako po kroku M.
5. **Čakanie na odpoveď servera** ku kúsku, ktorý je celý na ceste: bez zmeny oproti kroku M, rýchlosť klesá každú
   sekundu. Veľkosť ďalšieho kúska sa určuje hneď po odpovedi a ráta tak aj čas servera (analýza
   `meranie-rychlosti.md`, časť 3, bod 3).

**Čo merač nerozlíši.** `loaded` hovorí, koľko tela prevzal sieťový zásobník prehliadača (analýza `:78-79`). Keď sa
linka zastaví až potom, čo prehliadač prevzal celý kúsok (malý kúsok, pomalá linka), vyzerá to ako čakanie na server
a platí bod 5: rýchlosť klesá ako po kroku M. Pri veľkých kúskoch (videá v admin-dam) sa celé telo do zásobníkov
nezmestí a zastavenie sa pozná, okrem zastavenia až v chvoste kúska, ktorý zásobníky už prevzali (ich veľkosť som
nemeral). Keď udalosť nemá `total`, `loaded` ráta aj réžiu multipartu (`uploadMeter.ts:107`),
takže kúsok vyzerá celý na ceste o tú réžiu (desiatky až stovky bajtov) skôr (Codex M-A-c1; rovnakú nepresnosť mala
krivka už po kroku M).

Odchýlka od analýzy `meranie-rychlosti.md:115-116` („keď sa nič neposiela, rýchlosť klesá") je rozhodnutie vlastníka
a platí len pre kúsok, ktorý ešte nie je celý na ceste.

## Cyklus 1 (M-A-c1, 11. 10.; posudky Codex a Opus nad `zaplaty/M-A.diff`)

Prvý tvar hlásil len pri nových bajtoch. Posudky:

1. **Opus, stredná: čakanie na odpoveď servera prestalo vstupovať do veľkosti ďalšieho kúska.** Medzi odpoveďou
   (`uploadService.ts:154`) a určením veľkosti (`:133`) nie je tik, takže ďalší kúsok by sa riadil len tým, ako rýchlo
   telo prevzal prehliadač: kúsok prevzatý za sekundu s odpoveďou po 8 s by dal 5- až 15-krát väčší ďalší kúsok
   (lehota 30 s). Vracalo to chybu 3 z analýzy, ktorú krok M opravil. **Opravené:** druhá podmienka hlásenia
   (`answerAwaited()`), čakanie na server sa ráta ako po kroku M.
2. **Opus, stredná: opakovanie po lehote pri pomalom serveri** by ostalo rovnako veľké a po štyroch pokusoch by upload
   zlyhal. Tou istou opravou preč: počas čakania na odpoveď rýchlosť klesá a opakovanie sa zmenší ako po kroku M.
3. **Opus, vysoká (test admin-dam po kópii):** `src/test/upload/uploadSequence.test.ts:175-176` čaká hodnoty z tiku
   sekundu po posledných bajtoch (305 B/s a 4 s). Po kroku je ten tik tichý (kúsok je na ceste len z polovice) a
   riadok drží hodnoty tiku predtým, 382 B/s a 3 s (prepočet Opusa, platí aj po cykle 1). Test sa upraví v C4.
4. **Opus, nízke:** poznámka netvrdila bod 3 vyššie (doplnený); hlavička testu hovorila „reported once a second"
   (upravená); chýbal prípad posledného tiku bez nových bajtov (doplnený); záplata `M-A.diff` bola staršia než strom
   (vytvorená znova).
5. **Codex, stredná:** `shown =sendingOver` bez medzery (opravené pred snímkom `M-A-c1`). Inak bez nálezu.
6. **Mimo zmeny (do denníka):** hodiny idúce späť tesne pred odpoveďou na posledný kúsok zahodia krivku a posledné
   hlásenie „100 %, 0 s" nepríde (Codex; staršie, z kroku M); `damUploadChunkSize.ts:21-31` vráti `true`, aj keď sa
   orezaná veľkosť nezmenila, takže na hranici sa kúsok pred každým opakovaním číta znova (Opus; staršie).

## Cyklus 2 (M-A-c2, 11. 10.; Codex a úzky Opus nad `zaplaty/M-A-c1.diff`)

CK-LIB M-A-c1 zelená 311 / 4 257. Oba posudky: pravidlo je správne na všetkých cestách, nálezy 1 a 2 cyklu 1 sú preč
(mení sa len brána hlásenia, čísla hlásení sú tie isté ako po kroku M).

1. **Opus, nízka, skrytá:** pri kúsku nad asi 94,9 MB dá `loaded * chunkSize / total` o zlomok menej než veľkosť
   kúska (`total * chunkSize` prejde 2^53; nie pri každej dvojici, overené pre 100 000 001 a 100 000 501), takže taký
   kúsok by nebol „celý na ceste" a čakanie na server by bolo tiché, hlavne pri prvom kúsku. Hornú medzu kúska určuje konfigurácia backendu. **Opravené:** pri `loaded >= total` je na ceste celý kúsok
   bez delenia (`uploadMeter.ts:107-110`); prípad testu s kúskom 100 000 001 B.
2. **Opus, nízke (testy):** chvost prípadu čakania na server (po `attemptFailed`) nevedel zlyhať: vypustený. Nič
   nepripínalo, že brána sa odpoveďou zavrie: nový prípad „says nothing between the answer to a chunk and the request
   of the next".
3. **Codex, stredná (poznámka):** udalosť bez `total` a réžia multipartu, doplnené do „Čo merač nerozlíši".
4. **Opus, nízke (poznámka):** dve spresnenia vyššie (bod 3 zoznamu, veľké kúsky) a oprava tvrdenia o teste admin-dam.
