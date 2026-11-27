# Posudok prehľadu pre vlastníka, verzia 2 (Opus, deep-reviewer, 9. 10.)

Prepísané zo správ posudkového agenta (prvá správa bola skrátená v strede bodu 9; zvyšok poslal znova doslova).
Kľúče ciest: O = `…/krok5/prehlad-zjednotenia.md`; J, K, P = `navrh-jadro.md`, `navrh-komponenty.md`,
`plan-implementacie.md` v tom istom priečinku; D = `doc/2.0.0-analyza/upload-postup.md`; L = LIB `src/domains/dam/`.

1. **MISLEADING — §0, O:85-86.** "Bez tvojho slova sa nespustia len opravy F1, F2, F4, krok K2-D4, kroky otvorených
   tém a oprava PK3" contradicts O:72-75 and P:867-869, where V0 decisions block K2, K3 and K5. The log now says plan
   v2 puts all seven "na potvrdenie" before K2 and makes the finding-20 fix its own decision step. The owner could
   conclude that K2 to K6 run without them.
2. **GAP (code) — Z26/PV13, O:93-96, O:354, O:421.** The overview shows the visible effect as admin-dam only. The
   library has the same effect: its service writes `error.message` on a 422 validation answer, or on a 400 at the 4th
   attempt, checking only for Stop or cancel (L `uploadQueue/composables/uploadService.ts:183-195`); this happens
   after the settlement cleared the text on the server's `failed` (L `uploadQueue/settlement/uploadSettle.ts:356`);
   the row and the single-file dialog show that text in place of the reason chip
   (L `uploadQueue/components/UploadQueueItemEditable.vue:281-286`, `UploadQueueDialogSingle.vue:448-453`). So in
   admin-cms and admin-ugc the server's reason chip can be overwritten today, and F4 stops that. Same unverified
   core-dam behaviour. J:1599 (library column) misses this too.
3. **WRONG — §7.8, O:595-598.** Finding 46 in the log already names PageUp, PageDown and the letter landing at the
   old cursor (D:164). Not a live discrepancy.
4. **MINOR — §7.10, O:601-603.** The log's "nálezy mimo plánu" now carries the post-step-2 correction (row not red,
   D:741); only the third-set table still says "červený bez textu" (D:92).
5. **GAP — §4.1, O:454-477.** Second set, point 6: distribution polling reports every failed read, owner decision
   "nechať do kroku 5" (D:75, D:697-699). Neither design mentions it, nor does the overview.
6. **MINOR (code) — ZK26, O:342.** "Zalamujú ako v detaile" reads as "will now wrap", but the effect is the opposite.
   The dialog inherits `overflow-wrap: break-word` from `.v-card` (`node_modules/vuetify/lib/components/VCard/VCard.css:5`);
   the detail resets it to `normal` (L `assetDetail/components/AssetMetadata.vue:197`). Long unbroken values in the
   admin-cms/admin-ugc dialog would stop breaking and may be clipped. The K-04 browser check still catches it.
7. **MINOR — Z17, O:351 and O:407 (verbatim from J:1477).** "(dnes sa dosiela nevidený a asset ostane)" implies the
   asset no longer stays after the fix. It does stay: removing or stopping a row only stops and removes it; nothing
   deletes the asset (L `uploadQueue/store/uploadQueuesStore.ts:396-414, 470-491`). Only the remaining chunks stop.
8. **MINOR — O:65-66, O:421.** "Dve opravy chýb menia aj to, čo admin-dam ukáže (Z26, ZK13)" and "jediná oprava"
   understate: Z23/F1 changes the speed and remaining-time estimate shown in all three apps (J:1596;
   L `…/UploadQueueItemEditable.vue:259`); ZK18 changes what a screen reader announces in admin-dam.
9. **MINOR (code) — PK3, O:101 and O:449.** Only ArrowUp and ArrowDown are captured
   (L `uploadQueue/components/UploadQueueEditable.vue:65-72`). Left and Right still work, so "šípky" overstates.
10. **MINOR — finding 20, O:450.** "admin-ugc túto cestu nemá": the log means the UGC API has no such route (D:134,
    D:173). If admin-ugc can reach the "kopírovať do licencie" switch, the `endPointImage` fix would still fail
    there. admin-ugc not checked.
11. **MINOR — O:58-59 and O:428.** "14 členov sád … a profil usadenia" counts `settlement` twice; it is one of the 14
    (J:1075, J:1083-1084). O:428 lists ZK11 as visible, while O:338 and §7.3 follow the register's "nič viditeľné".

**Confirmed correct.** §0 counts match J:255-261 and K:180-193; the split 29+6+6+7+1 = 49 matches the registers.
All ten §3.1 quotes verbatim (substrings of J:1463-1487). §1 includes all 27 per-side and all 15 adapter rows in K
and all 15 per-side rows in J; every mechanism and side assignment checked is right. §4: PV9/10/12/14/15, findings
25, 36, PK3, 20/32/39 and 31 stated as the sources say. §7 items 1-7 and 9 are real discrepancies.

**What was checked.** The whole overview, the whole K, J sections 0-1, 2.8, 3.3, 5 and 6, D (findings table, three
decision sets, "Krok 5: stav") and P §7-8. Section 1 rows against code: RD3, RD4, RD5, RD8, RD9, RD12, RD13, RD15,
RD20, ZN2, ZN3, ZN7, ZN9, JS2, JS3, JS5, JS27, JS29, C59 (texts verbatim on both sides), B5, B15, C11, C21, C27, C42,
the finding-20 address in the three widgets. Z/ZK against code: Z1 (axios 1.20.0), Z2, Z4, Z5, Z11, Z12, Z15, Z16,
Z17, Z20, Z24, Z26, Z27, ZK1, ZK16, ZK26.

Overené vedúcim: bod 2 v kóde (`uploadService.ts:183-195`, `uploadSettle.ts:356`, `UploadQueueItemEditable.vue:281-286`)
a bod 9 (`UploadQueueEditable.vue:64-88`: šípky hore a dole, PageUp, PageDown, Home, End; doľava a doprava nie).
