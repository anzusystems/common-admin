# M: jeden merač rýchlosti a priebehu uploadu (PV4, PV12, Z28; impl-komp-lib)

**Stav: cyklus 1 (M-c1) hotový, CK zelená; čaká na posudok.**

Plán `plan-implementacie.md` 2.9 riadok „M" (`:1090`); jadro 2.3 pravidlo 4, 4.1, register Z28;
`analyzy/meranie-rychlosti.md` časť 4 (návrh) a 5 (testy). Strom LIB `/home/volar/projects/anzusystems/common-admin`
(po 25), TMPDIR `common-admin/node_modules/.cache/vitest-tmp-impl-komp-lib`.

## Podkroky

1. **Snímok `M`** pred prvou úpravou.
2. **Merač** (nový, nevyvezený `L/uploadQueue/composables/uploadMeter.ts`, `useUploadMeter(report)`): jedna krivka
   „odoslané bajty súboru v čase". `attempt(veľkosť kúska)` zapíše základ pri odoslaní požiadavky (F1, R1) a vráti
   poslucháča priebehu tohto pokusu (bajty na ceste `loaded × veľkosť / total`, najviac veľkosť kúska; neskorá udalosť
   skončeného pokusu sa nezapíše); `chunkDone` pripočíta kúsok a bod označí odpoveďou servera; `attemptFailed` krivku
   zahodí; `lastChunkSent` (Z9) a `stop` (Z10). Rýchlosť: bajty za posledných 10 s (ľavý okraj interpolovaný, pred
   oknom ostáva jeden bod), pravý okraj „teraz", po poslednom kúsku odpoveď naň; platí pri úseku aspoň 0,5 s alebo s
   odpoveďou servera. Hlásenie raz za sekundu, prvé hneď, len s rýchlosťou: percentá s bajtmi na ceste, nikdy nižšie
   než naposledy; zvyšný čas `ceil((veľkosť − odoslané) / rýchlosť)`; po poslednom kúsku 100 % a 0. Bez `report`
   žiadny tik. Hodiny späť: krivka odznova. Aritmetika najprv násobí (presné čísla pri deliteľných hodnotách).
3. **Služba** (`L-us`): vzorkovač (`progressCallback`, `speedStack`, `speedCheck`, `progress`, časové pečiatky)
   nahradil merač; `meter.attempt` v `uploadChunk` tesne pred požiadavkou, `chunkDone` po úspechu, `attemptFailed` v
   `catch` pokusu, `lastChunkSent` po slučke, `stopSpeedCheck` = `meter.stop` (ostáva vo vrátenom objekte).
   `setUploadSpeed`, `UploadProgressCallback`, `useDamUploadChunkSize` bez zmeny.
4. **Sady** (`L/uploadQueue/presets/uploadPresets.ts`): člen `speedBaseline` zmizol z typu aj z oboch sád.
5. **Testy:**
   - `LT/uploadServiceRetry.test.ts`, describe „the speed of an upload": hodiny stoja (`start + ahead`, predtým
     `realNow() + ahead`: pri okne 10 s by milisekundy stroja boli v číslach), súbor danej veľkosti, hlásenie aj s
     percentami. Prípad „is measured anew when a chunk is sent again: the try that failed is not counted, and the
     share does not go back" (pred krokom „…the bytes of the try that failed are not counted back", `:238-268`):
     `[{90, 9000, 1}]`, v pauze nič, opakovanie `{90, 2000, 4}`, koniec `{100, 5000, 0}` (predtým `[900]`,
     `[900, 900]`). Prípad „goes on from the chunk before when the next chunk is sent for the first time" (`:270-293`,
     názov bez zmeny): `[{90, 6000, 1}]` (predtým `[1750]`), sekunda odpovede servera sa ráta; komentár o D4 a
     otočení prípadu odstránený.
   - nový `LT/uploadMeter.test.ts` (11 prípadov, falošné hodiny): prvá udalosť od odoslania a len podiel kúska, kúsok
     s jedinou udalosťou, naprieč kúskami s odpoveďou servera, opakovaný pokus (pauza bez hlásenia, neskorá udalosť,
     percentá neklesnú), okno 10 s s interpoláciou okraja, pokles bez posielania, hranica 0,5 s, záverečných 100 % a
     0 bez ďalšieho tiku, `stop`, hodiny späť, bez `report` žiadny časovač.
   - `LT/uploadServiceSequence.test.ts:93-147` (`[34, 68, 100]`, zvyšok 0, sekundový rytmus) a
     `LT/uploadServiceApiTimeout` bez zmeny a zelené (analýza časť 5); `LT/uploadServicePresets` („leaves no second of
     the meter waiting…") ostal zelený, ale jeho tvrdenie „reports no more" po M pri zlyhanom kúsku nič netvrdilo
     (opravené v cykle 1, bod 4).
6. **Dôkaz** (v pamäti, snímok `M`; štyri súbory, 103 prípadov; skript `m-bend.sh`), každé ohnutie červené:
   bez strážcu pokusu 1 (opakovaný pokus); bez základu pri odoslaní 11; `attemptFailed` bez zahodenia 2 (opakovaný
   pokus v merači aj v službe); bez hranice 0,5 s 1; bez odpovede v úseku 2 (malý súbor, `uploadServiceSequence`);
   bez okna 2; bez interpolácie 2; orezanie bez bodu pred oknom 1; percentá bez „nikdy nižšie" 2; bez obnovy pri
   hodinách späť 1; tik aj bez `report` 14; pravý okraj „teraz" aj po poslednom kúsku 1; bajty na ceste bez podielu
   kúska 1; služba bez `chunkDone` 2, bez `attemptFailed` 1, bez `lastChunkSent` 1. Služba a sady zo snímku `M`
   (`N39L_OLD`) → červené 2 / 103 (oba prípady `uploadServiceRetry`).
7. **Behy** (skripty `m-check.sh`, `m-check2.sh`, `m-lint.sh`): cielené 83 súborov / 1 641 zelených
   (`uploadQueue/__tests__`, `core`, `settlement`, `L/__tests__`, `imageWidget/__tests__`, `src/test`); `oxfmt`,
   `oxlint`, `eslint` na piatich súboroch čisté, `lint:tsc` 0. Prvý beh: prípad okna padol na plávajúcej čiarke
   (`55.00000000000001`, 951), aritmetika prepísaná na „najprv násobiť".
8. **Register**: `navrh-jadro.md` 6, Z28 (posledný stĺpec: hotové v LIB, tvar volaní, testy).
9. **Záplata** `zaplata.sh M` → `krok5-praca/zaplaty/M.diff` (5 súborov v `src`; mimo `src` a `doc` nič), pred CK.
   **CK-LIB M v LIB zelené** (`vysledky/M-ck.log`): `test:browser` 306 / 4 051 (25 + 1 súbor, + 11 prípadov),
   `test:eslint` 7 / 82, ostatné čisté, `lint:eslint` 4 staršie varovania.

## Zmenené súbory

- `src/domains/dam/uploadQueue/composables/uploadMeter.ts` (nový)
- `src/domains/dam/uploadQueue/composables/uploadService.ts`
- `src/domains/dam/uploadQueue/presets/uploadPresets.ts`
- `src/domains/dam/uploadQueue/__tests__/uploadMeter.test.ts` (nový)
- `src/domains/dam/uploadQueue/__tests__/uploadServiceRetry.test.ts`
- `doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md` (Z28)

## Čo sa mení pre používateľa

Rozhodnuté vlastníkom 9. 10. (PV4, PV12, Z28; analýza časť 6). admin-cms a admin-ugc (dialóg fronty, dialóg jedného
súboru, widgety cez ne): kruh a percentá sa hýbu aj počas kúska, lebo bajty kúska na ceste sa rátajú do podielu aj
do zvyšného času (`ceil((veľkosť − odoslané) / rýchlosť)`). Súbor z jedného kúska už nestojí na „0 %"; keď prehliadač
prevezme celé telo posledného kúska, ukáže sa 100 % a 0 s už počas čakania na odpoveď servera (jednokúskový súbor
teda namiesto „0 %" čaká na „100 %"). Čakanie na server sa do zvyšného času premieta len cez rýchlosť (odpovede
predošlých kúskov ju znižujú, odhad je skôr dlhší), čakanie na odpoveď k poslednému kúsku v ňom nie je. Pri
opakovanom pokuse percentá neklesnú a v pauze pred ním ostanú posledné hodnoty; súbor nahraný do 1 s dostane 100 %
takmer vždy. Na backend idú tie isté požiadavky,
len veľkosti kúskov sa mierne zmenia (veľkosť ďalej číta nahlásenú rýchlosť, ktorá teraz ráta aj čas servera;
vnútorné podľa Z28). admin-dam až s C3 (kópia LIB; testy DAM podľa plánu 2.9 a C3). Text ani kľúč sa nemení.

## Odchýlky

1. **Tvar volaní merača:** `attempt(veľkosť)` a `attemptFailed()` namiesto náčrtu `attempt(veľkosť, attempt > 1)`
   (analýza 4, jadro 2.3 pravidlo 4). Náčrt zahodí krivku až pri ďalšom pokuse, takže tik v pauze (1, 3, 9 s) by
   hlásil klesajúcu rýchlosť z bajtov, ktoré server neprijal; tabuľka analýzy chce „v pauze tik nehlási a riadok drží
   posledné hodnoty". Strážca pokusu (neskorá udalosť skončeného pokusu sa nezapíše) navyše.
2. **Hodiny v `LT/uploadServiceRetry.test.ts`** stoja (`start + ahead`); predtým bežali s časom stroja, čo pri
   vzorkách z 1 000 s nevadilo, pri okne 10 s by áno.
3. Merač má asi 125 riadkov (analýza „asi 90"), rozdiel sú komentáre a typ bodu.
4. Krok robil agent impl-komp-lib namiesto impl-jadro-lib z plánu (rozhodnutie vedúceho, úspornosť).

## Na vedomie vlastníkovi

1. **100 % a 0 s počas čakania na odpoveď k poslednému kúsku** (posudky Codex 2, Opus 2): bajty na ceste sú v podiele
   aj v zvyšnom čase, takže po prevzatí tela posledného kúska prehliadačom je kruh plný a čas 0, hoci server ešte
   neodpovedal. Pri súbore z jedného kúska sa „0 %" po celý čas zmenilo na „100 %" počas čakania na server. Plynie z
   rozhodnutého „percentá aj počas kúska" (analýza „pre vlastníka" bod 2); kód sa nemení.
2. **Úplné zastavenie toku** (posudok Opus 1; kód sa nemení, analýza `meranie-rychlosti.md:115-116` pokles pri tichu
   chce a prípad „slows down while nothing is sent" ho pripína): kým okno 10 s ešte drží posledné bajty, tik hlási
   stále nižšiu rýchlosť a dlhší zvyšný čas; posledné hlásenie pred tichom počíta už len úlomok intervalu a ostane v
   riadku, kým nepríde ďalší bajt. Čísla posudku Opusa (neprepočítaval som ich): pri 1 MB/s 20 s a potom nič ostane
   8 000 až 98 000 B/s a 2,8 až 34 h (pred M ostal odhad asi 1 000 s), a veľkosť ďalšieho kúska, ktorá číta túto
   rýchlosť (`L-us:133,176`, `damUploadChunkSize.ts:20-25`), klesne z 50 MB na 1 až 1,5 MB. Možnosti: **(A)** hlásiť
   len vtedy, keď od predošlého hlásenia pribudli bajty (pri úplnom zastavení ostane posledný skutočný odhad ako pred
   M; pri spomalení klesá); **(B)** po vyprázdnení okna ohlásiť nulovú rýchlosť bez zvyšného času; **(C)** nechať.
   **Rozhodnuté vlastníkom 11. 10.: A**, krok M-A (`impl/M-A.md`).

## Zblíženia navyše (tvar registra)

Žiadne (Z28 je plánované).

## Nové nálezy

Žiadne.

## Cyklus 1 (M-c1, 11. 10.; posudky Codex a Opus)

Snímok `M-c1` (strom po U7).

1. **Úplné zastavenie toku** (Opus 1): kód sa nemení (rozhodnutie vedúceho po kontrole proti analýze `:115-116`, ktorá
   pokles pri tichu chce); dôsledok a možnosti A až C sú v „Na vedomie vlastníkovi" a v Z28.
2. **Body s rovnakou milisekundou** (Codex 1, Opus 3; `uploadMeter.ts`, `speed`): pravý okraj krivky je posledný bod
   (`points.at(-1)`; žiadny bod nie je neskôr než koniec úseku), nie prvý bod tej milisekundy, ktorý vracalo
   `sentAt(end)`; konečná rýchlosť bola pri falošnom čase podhodnotená (testy admin-dam v C3). Ľavý okraj ostáva prvým
   bodom milisekundy (`sentAt`): základ pokusu a jeho prvá udalosť v tej istej milisekunde sa tak rátajú; pokyn „ber
   posledný (`findLastIndex`)" som preto uplatnil len na pravý okraj. Nové prípady `LT/uploadMeter.test.ts`: „counts
   everything told in the millisecond of the last answer" (1 053 B/s; pred opravou 790) a „counts what a chunk tells of
   itself in the millisecond of its request".
3. **Pravdivý zápis** (Codex 2, Opus 2): „Čo sa mení pre používateľa" a Z28 hovoria, že bajty na ceste sú v podiele aj
   v zvyšnom čase a že počas čakania na odpoveď k poslednému kúsku je 100 % a 0 s; zapísané aj „na vedomie
   vlastníkovi".
4. **`LT/uploadServicePresets.test.ts`** (Opus 6): komentár „The meter has a speed" opravený; prípady „a failed upload
   that reports its progress" rozdelené podľa toho, či bol kúsok zodpovedaný. Sedem prípadov bez zodpovedaného kúska
   tvrdí už len „leaves no second of the meter waiting": zlyhaný pokus krivku zahodí, takže „reports no more" tam
   nemohlo zlyhať (po zlyhaní niet čo ohlásiť, ani keby časovač bežal). Prípad so zodpovedaným kúskom („its finish is
   refused") tvrdí oboje: merač má rýchlosť a ponechaný tik by ohlásil celý súbor. Prípad `stop()` počas kúska bol v
   M-c1 zaradený k nemu omylom: `stop()` kúsok zruší skôr, než odpoveď príde meraču; od U7-c1 je medzi prípadmi bez
   zodpovedaného kúska (posudok Codex k M-c1). Počet prípadov sa nemení (9 na sadu).
5. **Poznámka**: riadok plánu `:1090`, veta o `uploadServicePresets` v podkroku 5, odchýlka 4 (agent).

**Dôkaz** (v pamäti, snímok `M-c1`; štyri súbory, 105 prípadov; skript `mc1-check.sh`): pravý okraj cez `sentAt(end)`
→ 1 / 105; ľavý okraj posledným bodom milisekundy → 1 / 105; služba bez zastavenia merača v `catch` → 16 / 105 (sedem
prípadov a „finish is refused" v oboch sadách); bez zastavenia v `stop()` → zelené (zastaví ho `catch`; `stop()` ho
zastavuje len skôr); bez oboch → 18 / 105; merač zo snímku (`N39L_OLD`) → 1 / 105.
**Behy**: cielené 53 súborov / 1 245 zelených (`uploadQueue`, `L/__tests__`); `oxfmt`, `oxlint`, `eslint` na troch
súboroch čisté, `lint:tsc` 0. Záplata `zaplaty/M-c1.diff`. **CK-LIB M-c1 zelené** (`vysledky/M-c1-ck.log`): `test:browser` 308 / 4 074 (U7 + 2),
`test:eslint` 7 / 82, ostatné čisté.

Zmenené súbory cyklu: `uploadQueue/composables/uploadMeter.ts`, `uploadQueue/__tests__/uploadMeter.test.ts`,
`uploadQueue/__tests__/uploadServicePresets.test.ts`, `impl/M.md`, `navrh-jadro.md` (Z28).
