# ORIGIN-CHECK: kontrola pôvodu socket.io a Hocuspocus v `next`

Pokyn vlastníka: bezpečnostná oprava. Mení sa len kód, premenné prostredia nie. Worktree `krok5-praca/collab-next-wt`,
vetva `next` nad 9a2ed0f, necommitnuté. Skripty a logy sú v `krok5-praca/origin/`.

## 1. Problém

- **Doterajšia kontrola**: socket.io (`src/server/collaboration.ts`, `allowRequest`) a Hocuspocus
  (`src/server/document/onUpgradeHook.ts`) púšťali pôvod cez `new RegExp(COLLABORATION_SERVER_CORS).test(origin)`.
- **Produkcia**: `COLLABORATION_SERVER_CORS=https://admin-cms.sme.sk`, bez kotiev a s neescapovanými bodkami. Prešli
  by teda aj `https://admin-cms.sme.sk.utocnik.sk` alebo `https://admin-cmsxsme.sk`.
- **Cookies**: cookies core-cms sú `SameSite=None` na `.sme.sk`, takže stránka takého pôvodu by otvorila spojenie ako
  prihlásený editor.

## 2. Oprava

**`src/util/allowedOrigin.ts`**, funkcia `isAllowedOrigin(request)`, rovnaká pre socket.io aj Hocuspocus:

1. **Bez `Origin`** (chýba alebo je prázdny) je požiadavka odmietnutá.
2. **`Sec-Fetch-Site`**:
   - prítomná a iná ako `same-origin`, `same-site` alebo `none` (teda `cross-site` alebo neplatná) → odmietnutie;
   - chýba → rozhoduje len pôvod (§3).
3. **`COLLABORATION_SERVER_CORS` bez úvodného `^`** je presný pôvod, porovnaný ako reťazec. S čiarkami je to zoznam
   presných pôvodov (časti sa orežú od medzier).
4. **S úvodným `^`** je to regex, testovaný vždy na celý pôvod: `^(?:<hodnota>)$`.
   - Platí aj pre regex, ktorý autor neukotvil na konci.
   - Platí aj pre regex s `|`: skupina zabráni, aby druhá alternatíva platila kdekoľvek.

**Volania**:

- socket.io `allowRequest` aj Hocuspocus `onUpgrade` volajú `isAllowedOrigin`.
- Pri odmietnutí sa správanie nemení: `warn` s pôvodom; socket.io `allowRequest` vráti `false`, Hocuspocus odpovie 403.

**Hodnoty v prostrediach**:

- produkcia (`https://admin-cms.sme.sk`) je presný pôvod;
- `.env.dist` (`^http://[a-zA-Z0-9-_.]+.sme.localhost(:\d{2,4})?$`) je regex na celý pôvod.
- Hodnoty na devel a stage som nevidel. Ak niektorá je regex bez úvodného `^` (napríklad `.*\.smedevel\.sk`), po
  nasadení sa porovná ako presný pôvod a admin-cms sa nepripojí. Treba ich overiť pred nasadením (changelog to uvádza
  ako požiadavku).

## 3. `Sec-Fetch-Site` pri WebSocket handshake (prieskum)

**Špecifikácia**: handshake WebSocketu ide cez Fetch, takže hlavičky Fetch Metadata k nemu patria.

- WHATWG WebSockets: algoritmus „establish a WebSocket connection" vytvorí request s mode `"websocket"` a zavolá na
  neho *fetch*. Robí to práve preto, aby CSP, cookies, HSTS a ďalšie protokoly Fetch boli na jednom mieste
  ([websockets.spec.whatwg.org](https://websockets.spec.whatwg.org/)).
- Fetch Metadata pridáva `Sec-Fetch-*` v „HTTP-network-or-cache fetch". `Sec-Fetch-Mode` má aj hodnotu `websocket`.
  Hlavičky idú len na *potentially trustworthy* URL, teda `wss://` alebo localhost, nie `ws://` na iný host
  ([w3c.github.io/webappsec-fetch-metadata](https://w3c.github.io/webappsec-fetch-metadata/)).
- Anne van Kesteren (2022-10-14): „Per Fetch they should be included" ([WebKit bug
  237550](https://bugs.webkit.org/show_bug.cgi?id=237550)).

**Prehliadače**:

| prehliadač | posiela `Sec-Fetch-Site` pri WebSockete | zdroj |
|---|---|---|
| Firefox | **áno** (len trustworthy URL) | `dom/security/SecFetch.cpp`: `TYPE_WEBSOCKET` → `mode = "websocket"`, `AddSecFetchHeader` končí pri netrustworthy URL ([searchfox](https://searchfox.org/mozilla-central/source/dom/security/SecFetch.cpp)); v bugu 237550 (2022) „Firefox does attach metadata" |
| Safari (WebKit) | **áno**, od opravy 2022-11-10 (commit 256527@main); prvú verziu Safari s ňou bug neuvádza | [WebKit bug 237550](https://bugs.webkit.org/show_bug.cgi?id=237550) |
| Chrome, Edge (Chromium) | **nie** | v bugu 237550 (2022): „Chromium does not attach any metadata to the websocket handshake request". Dnes v zdrojoch Chromium (`main`) žiadna hlavička `Sec-Fetch-*` pri handshake nie je |

Zdroje Chromium, ktoré som prečítal:

- [net/websockets/websocket_stream.cc](https://chromium.googlesource.com/chromium/src/+/main/net/websockets/websocket_stream.cc)
  nastaví len `Upgrade`, `Connection`, `Origin` a `Sec-WebSocket-Version`;
- [websocket_basic_handshake_stream.cc](https://chromium.googlesource.com/chromium/src/+/main/net/websockets/websocket_basic_handshake_stream.cc)
  pridá `Sec-WebSocket-Key`, rozšírenia a protokoly;
- [services/network/websocket.cc](https://chromium.googlesource.com/chromium/src/+/main/services/network/websocket.cc)
  a [blink websocket_channel_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/modules/websockets/websocket_channel_impl.cc)
  nevolajú `SetFetchMetadataHeaders`.
- Pri bežnom `fetch`/XHR Chromium `Sec-Fetch-Site` posiela. MDN: „Baseline: Widely available" od marca 2023
  ([MDN Sec-Fetch-Site](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site)).

**Neoverené**: žiadnym prehliadačom som to naživo nemeral. Ide o odvodenie zo zdrojov a z bug trackeru. Chromium
by to mohol zmeniť bez zmeny, ktorú som našiel.

**Návrh**:

- Pri soketoch `Sec-Fetch-Site` **nevyžadovať**. Chrome a Edge, ktoré editori používajú najčastejšie, ju pri WebSockete
  neposielajú, takže by sa nepripojili.
- Odmietnuť ju len vtedy, keď je prítomná a hovorí `cross-site` (Firefox, Safari). Tak je to implementované.
- Hlavnou ochranou je presný pôvod. `Origin` pri WebSocket handshake posiela každý prehliadač (RFC 6455) a stránka ho
  nemôže podvrhnúť.
- Pre štatistiky vo `feature/collab-stats` (bežný `fetch`) je vyžadovanie `Sec-Fetch-Site` v poriadku, Chromium ju
  tam posiela. Po zlúčení `next` prejdú na `isAllowedOrigin`, s povinnou `Sec-Fetch-Site` navyše.

## 4. Testy a kontroly

**Testy**:

- `test/allowedOrigin.test.ts` (20):
  - presný pôvod (`https://admin-cms.sme.sk`) a podobné pôvody (`.utocnik.sk`, `admin-cmsxsme.sk`, subdoména, port,
    `http`);
  - zoznam s čiarkami;
  - regex z `.env.dist` (`http://x.sme.localhost:3000` prejde, `http://x.sme.localhost.evil` nie);
  - regex bez koncovej kotvy a s `|`;
  - bez pôvodu;
  - `Sec-Fetch-Site` (`same-origin`, `same-site`, `none` a chýbajúca prejdú, `cross-site` a prázdna nie).
- `collaboration.test.ts` (+1), socket.io `allowRequest`:
  - presný pôvod a `same-site` prejdú;
  - `cross-site`, `http://localhost.evil` a chýbajúci pôvod nie.
- `hocuspocus.test.ts` (+2), skutočný WebSocket:
  - `cross-site` → 403, `same-site` → 101;
  - pri `^http://localhost` dá `http://localhost.evil` 403, pri presnom `http://localhost` dá `http://localhostxevil`
    403 a `http://localhost` 101.

**Kontroly** (každá cez `flock` na `tazky.lock`, `krok5-praca/origin/kontroly.sh`) skončili všetky s 0:

- `yarn lint:fix`, `yarn ci`, `yarn build` a `yarn tsc`;
- `yarn test` 3×: 22 súborov, 169 testov.

**Changelog**: `doc/Collaboration-Changelog/Unreleased/origin-check.md`. Opisuje, ako sa `COLLABORATION_SERVER_CORS`
teraz vykladá, a uvádza ako požiadavku tvar hodnoty.

**Návrh správy commitu**: platí ten v §5.

## 5. Po posudkoch (Codex `posudky/origin-check-codex.md`, Opus): druhé kolo

Necommitnuté v tom istom worktree.

1. **Test socket.io so skutočným handshakom**:
   - `COLLABORATION_SERVER_CORS=https://admin-cms.sme.sk` (bez `^`, ako produkcia);
   - `https://admin-cms.sme.sk` dá 101;
   - `https://admin-cms.sme.sk.evil`, `https://admin-cms-sme.sk` a `http://admin-cms.sme.sk` dajú 400. engine.io
     odpovedá na odmietnutý upgrade 400 s textom „Forbidden".
2. **Hodnota sa spracuje raz** (`prepareAllowedOrigin()` pri štarte socket.io aj Hocuspocus, potom z cache pre tú
   istú hodnotu).
   - Regex sa skompiluje raz. Neplatný dá jeden `warn` a nepustí nikoho, pri požiadavke nehádže.
   - Presná hodnota, ktorá nie je pôvodom (`new URL(v).origin !== v`, napríklad koncová lomka, cesta alebo chýbajúca
     schéma), dá `warn`, ale v zozname ostane (nič s ňou nezhodne).
3. **`Sec-Fetch-Site` pri soketoch je zrušená**: rozhoduje len pôvod (§3 platí ako prieskum).
   - Pri handshaku s naším pôvodom môže byť len same-site alebo same-origin, takže by nič nepridala. Safari by ju
     lokálne mohlo poslať inak.
   - Štatistiky vo `feature/collab-stats` si svoju povinnú kontrolu nechávajú.
4. **Odmietnutý handshake sa loguje ako `info`, nie `warn`** (socket.io aj Hocuspocus): pôvod si volí klient a každý
   pokus by šiel do Sentry.
5. **Autorizácia dokumentu** (`authorizeDocument.ts`): Hocuspocus overoval len miestnosť z `?roomName` a
   `documentName` nekontroloval, takže editor miestnosti A mohol cez to isté spojenie otvoriť telo článku B.
   - Teraz sa odmietne `documentName`, ktorý nezačína `<roomName>:`, ešte pred cookies.
   - Overené tvary:
     - admin-cms otvára `HocuspocusProvider` s `url …?roomName=<room>` a `name: <room>:<field>`
       (`admin-cms/src/domains/system/composables/collab/hocuspocus.ts`), napríklad `cms:article:123` a
       `cms:article:123:body`;
     - `fetchDocument.ts` z mena odvodí pole ako `documentName.replace(<room>:, '')`;
     - info miestnosť `<room>:info` je len miestnosť socket.io, dokument v nej nie je. Používateľ len v nej je ďalej
       odmietnutý (skutočné `fetchSockets` miestnosti ho nevráti), read-only vetva ostáva.
   - Dvojbodka v predpone vylúči `cms:article:61:body` pre miestnosť `cms:article:6`.
6. **Changelog `origin-check.md`**: hodnota sa spracuje raz s varovaniami, odmietnutie sa loguje ako info a nový
   bod o autorizácii dokumentov miestnosti. Bez Sec-Fetch-Site.

**Testy**:

- `allowedOrigin.test.ts`:
  - presný pôvod, zoznam, regex `.env.dist`, regex bez koncovej kotvy, bez pôvodu;
  - `Sec-Fetch-Site` sa neberie do úvahy;
  - regex sa kompiluje raz;
  - neplatný regex nepustí nikoho s jedným `warn`;
  - presná hodnota, ktorá nie je pôvodom, dá `warn`.
- `collaboration.test.ts`: skutočný handshake socket.io (101 a 400).
- `hocuspocus.test.ts`:
  - odmietnutie sa loguje ako `info` bez `warn`;
  - dokument inej miestnosti (`cms:article:7:body`, `cms:article:61:body`) cez spojenie miestnosti 6 → permission-denied.
- `authorizeDocument.test.ts`: cudzí dokument je odmietnutý pred cookies (`cms:article:2:body`,
  `cms:article:12:body`, samotná miestnosť, `body`). Vlastný dokument aj info (read-only) prejdú existujúcimi testami.

**Kontroly** (cez `flock`) skončili všetky s 0: `yarn lint:fix`, `yarn ci`, `yarn test` 3× (22 súborov, 172 testov),
`yarn build` a `yarn tsc`.

**Návrh správ commitov** (dva, bod 5 je samostatná oprava):

```
fix: the origin of socket.io and Hocuspocus WebSockets is checked whole: COLLABORATION_SERVER_CORS without a leading ^ is an exact origin or a comma-separated list, with ^ a regex of the whole origin, read once at the start with a warning for a value it cannot use; a request without an origin is refused and a refused one logged as info
```

```
fix: Hocuspocus authorizes only the documents of the room of the connection, <room>:<field>
```

