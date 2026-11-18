# PV14c-L4 — adversarial review (Claude)

Scope: the PV14c-L4 patch (`krok5-praca/zaplaty/PV14c-L4.diff`, 15 files; `diff -rq` of the snapshot against the tree
shows exactly its 13 `src` files), read against the brief with the leader's addendum, plan PV14c (choices 2 and 5),
the analysis gaps P1-P3 and Codex's point on one bus without an origin. Consumers read: admin-cms, admin-ugc,
admin-dam. Nothing was run; the logs were read.

Counts: High 0, Medium 0, Low 7. Outside the step: Low 1, and one process note.

## Findings

### High

None.

### Medium

None.

### Low

**L1. A configuration's failure streak outlives its last queue while another configuration still polls.**
`src/domains/dam/uploadQueue/settlement/uploadSettlement.ts:878-882` (every lane is reset only when no poller is
left), read at `:407` and `:581` (`report: !lane.failing …`).
Scenario: a page with `default` and `own` on two DAMs; `own`'s DAM answers 5xx. `own`'s queue reports its first failed
read (own lane `failing = true`). The user closes `own`'s upload dialog (`stopUpload` → `clearQueue` → `dropQueue`,
`uploadQueueCore.ts:272-299`; callers e.g. `UploadQueueDialog.vue:123`) while `default`'s queue still polls. Later the
user uploads under `own` again, the DAM still down: no read of the new rows is let report, so the api error logger
hears nothing of that outage until an `own` read answers. On the snapshot `default`'s answering reads ended the one
streak and that failure was logged. The rule the comment at `:880` states ("Nothing is asked about any more: what
fails for the next rows is a streak of its own") no longer holds per lane. The rows still get their read warning after
three failures; only the log entry is lost.
Fix: in `dropQueue`, take `const lane = laneOfQueue(queueKey)` before the poller is deleted, and when no remaining
poller's queue is in that lane set `lane.failing = false` (keep the reset of all lanes when none is left). One case in
`uploadSettlementLanes.test.ts`.

**L2. Two of the new mechanisms have no case that would turn red.**
(a) The lane of a read a notification asks for (`uploadSettlement.ts:542`, `:578`). The lane cases hold only a refresh
(`readOneNow`, `uploadSettlementLanes.test.ts:88-105`) and fail only the poll (`:107-118`); the notification cases
(`damNotificationsNamed.test.ts:207-239`) neither hold nor fail a read, and the PV14c-L3 cases of
`uploadSettlementConfigurations.test.ts` hold none either. By reading, `enqueueRead(laneOf(undefined), …)` at `:542`
(every notification read of every configuration back in one lane) passes all 13 new cases; b3 bends `laneOf` as a
whole. With sockets alive the poll is sparse and most reads of the library store are notification reads, so this is
the main path of the addendum.
(b) No case at the store level that a configuration with an open socket of its own polls sparse: the dense case
(`damNotificationsNamed.test.ts:194-205`) and b2 pin only "no socket → dense". `isPushAlive: (queueKey) =>
configOf(queueKey) === 'default' && useDamNotificationsConnection().isPushAlive()` would pass every case (the settle
cases advance 1 s only).
Fix: (a) one case: `own`'s fake DAM held, `asset_file_processed` of `a-1` on `own`'s socket, then on `default`'s;
`default`'s row is uploaded while `own`'s read is on its way. (b) one case: `own` with `OWN_ADDRESS` accepted and
`default`'s socket not: `own`'s first read at 10 s, `default`'s at 5 s. Not verified by running the mutations.

**L3. One callback registered twice is now heard twice.**
`src/domains/dam/composables/damNotifications.ts:177-187`. On the snapshot `eventBus.on(callback)` put the callback
itself into VueUse's `Set` (`node_modules/@vueuse/core/dist/index.js:3412-3418`): the same function added twice was one
listener (each event once; the first `off()` removed it). Now each call adds its own wrapper: two registrations, two
calls per event, and each `off()` removes one. A behaviour change of a public function for `default`-only consumers,
whom the changelog (`doc/changelog/2.0.0.md:61`) tells "as before". Not reachable in the three admins: admin-dam
registers one inline arrow once, guarded (`admin-dam/src/domains/system/composables/appNotificationListeners.ts:18-21,30`),
admin-cms and admin-ugc register none.
Fix: accept it and say so in the changelog (arguably the better semantics), or keep the identity with a
`WeakMap<callback, Map<optionsKey, wrapper>>` that hands back the existing wrapper.

**L4. Listeners get the socket's own array as `origin`.**
`damNotifications.ts:50,183`, `commonAdminCoreDamOptions.ts:124,132-133`, `damNotificationsConnection.ts:11-16`. The
one `configNames` array of a socket is emitted with every event, handed to every public listener as `origin`, put into
every settlement event, and is the list `setDamNotificationsPushAlive` writes the socket's state under. A listener that
mutates it (`origin.push(…)`, `origin.splice(…)`, `origin.length = 0`) changes the origin of every later event of
that socket and which configurations its open/close marks alive. The library itself only copies it
(`uploadSettlement.ts:504`, `uploadSettle.ts:232-233`).
Fix: `Object.freeze` each `configNames` once `damNotificationSockets()` has built it, or emit `[...configNames]`.

**L5. A named address the browser refuses breaks the page's `openConnection()`.**
`damNotifications.ts:95-99` (`all.forEach((socket) => socket.openConnection())`). VueUse's `_init` calls
`new WebSocket(url)` unguarded (`node_modules/@vueuse/core/dist/index.js:8419-8421`, `open` at `:8477-8483`), which
throws `SyntaxError` for an address that does not parse, has a fragment or another scheme. With a named
`notification` so misconfigured, the handle's `openConnection()` throws after `default`'s socket opened, and the
sockets after it never open. Callers that work with `default` alone are hit by a named configuration: admin-dam's
`initAppNotificationListeners` takes its `default` listener off and rethrows (`appNotificationListeners.ts:79-85`);
admin-cms's `onMounted` stops before `initGlobalDragState()` (`admin-cms/src/App.vue:22-27`). Before, only the root
address could do this; not reachable with `default` alone.
Fix: open each socket in its own `try`; rethrow for `default`'s socket as today, `console.error` a named one and go on.

**L6. Documents not exact in places.**
- `src/domains/dam/uploadQueue/settlement/uploadSettlementTypes.ts:66-75`: the exported `configOf` does not say that
  with it the reads of different configurations run in parallel (a lane each, and one for reads that name none);
  `:43-53` still says "a read that answers ends the streak" — with `configOf` only a read of the same configuration
  does. An application with a store of its own and `configOf` learns this only from the changelog.
- `doc/changelog/2.0.0.md:61`: leaves out the lane of reads that name no configuration (the note has it,
  `PV14c-L4.md:38`); "`status` and `damNotificationsInitialized` stay those of `default`'s socket" — the latter is the
  page's flag, raised by the handle's `openConnection()` whatever sockets exist (`damNotifications.ts:97`); and it does
  not say that `useDamNotificationsConnection()` without a name is `default`'s whatever component calls it (the JSDoc
  says so, `damNotificationsConnection.ts:19`), while the per-name composables of `:76` inherit the ancestor's name.
- `doc/changelog/2.0.0.md:76` ("equal asset ids under them are not told apart") and `src/AnzuSystemsCommonAdmin.ts:109`
  ("taken for one DAM"): for `asset_file_processed`, `asset_file_copied` and `asset_metadata_processed` the code reads
  the asset once for each configuration of the shared socket, by its own client (`uploadSettlement.ts:504`; pinned by
  `damNotificationsNamed.test.ts:227-239`); only `asset_file_failed` and `asset_file_duplicate` are written into the
  rows of both as the event says (the duplicate's original is then read per configuration).
- `doc/guide/installation.md:66`: "`initDamNotifications()` opens a socket for each distinct service" — it makes
  them; `openConnection()` opens them.
Fix: the sentences as above.

**L7. The admin-cms check the brief and the note rely on does not touch the handle.**
Brief `zadanie-PV14c-L4.md:42` and note `PV14c-L4.md:73-74` (after `overenie17-pv14c-claude.md:328`) say
`admin-cms/src/test/appInitialize/notificationTeardown.test.ts` covers the DAM handle. It does not: it mocks
admin-cms's own `useAppNotificationConnect` (`:11-18`), and `appInitialize.ts:1-34` imports nothing of the DAM
notifications. admin-cms uses the handle only in `App.vue:3,16,25` (`initDamNotifications()` in setup,
`openConnection()` in `onMounted`), which no admin-cms test mounts (`articlePages.test.ts:122` names it in a comment).
The test will pass after the copy — it passes whatever L4 does — and proves nothing about the handle.
Fix: after the copy run admin-cms `lint:tsc` (the destructuring at `App.vue:16`) and look at one start-up (one socket,
to the root address); correct the note.

## The five checks

### 1. Origin, equal asset ids, a shared address

- Each socket emits its `configNames` with the event (`damNotifications.ts:50`); the library store listens with
  `{ all: true }` and turns the origin into the `configNames` of every settlement event
  (`uploadQueuesStore.ts:250-277,287-295`).
- Every event kind goes through `concerns`: `processed`, `copied` and `metadata` through `anyRowMatches` and
  `scheduleNamed` with the names, one pending read per (name, asset) (`uploadSettlement.ts:497-537`), read by a queue
  of that name (`:571,584`) and written with those names (`:640-645`); `failed` through `settleKnownFailed`
  (`uploadSettle.ts:437-445`); `duplicate` through `markDuplicates` and `becomeOriginals` per configuration
  (`uploadSettle.ts:625-643`). An event of `a-1` on `own`'s socket touches no `default` row and the other way round
  (`damNotificationsNamed.test.ts:207-225`: red on the snapshot, red under b1).
- Codex's point is closed: a listener without options hears only `default`'s socket (`damNotifications.ts:183-184`),
  so admin-dam's listener cannot hear a named socket; pending reads are per configuration (PV14c-L3).
- A shared address: one socket named `['default','own']` (`commonAdminCoreDamOptions.ts:129-133`); its events concern
  the rows of both, its state is set for both. As plan choice 5 says, with the nuance of L6 (reads per configuration).
- A named configuration without `notification`: no socket, push false, its queue polls dense
  (`damNotificationsConnection.ts:25`, `uploadQueuesStore.ts:219-222`, `uploadSettlement.ts:804`).

### 2. `default`-only admins

- admin-cms (`main.ts:57-69`: `configs.default` only, root `notification`), admin-ugc (root `enabled: false`, never
  calls `initDamNotifications`), admin-dam (`main.ts:39-49`, `plugins/commonAdminCoreDam.ts:9-13`: `default` only).
  `damNotificationSockets()` gives one socket from the root options, named `['default']`: the same `useWebSocket`
  options, warning timer and text, reconnect (5 × 5 s), `openConnection` guard, `damNotificationsInitialized` and
  `status`; only the memo key changes its form (`default=…`).
- admin-dam's listener `(event) => …` is called with `(event, ['default'])`; a one-parameter arrow ignores the second.
  Its store's `connection: useDamNotificationsConnection()` (`admin-dam/.../uploadQueuesStore.ts:365`) answers
  `pushAlive.default` and ignores the queue the settlement now passes. Its profile has no `configOf` (grep: none), so
  one lane keyed `undefined`, and its `notify` calls carry no names, as before.
- The library store under `default` only: events now carry `['default']`, pending keys become `default\0<id>`, reads go
  to the `default` lane; every queue is `default`'s, so the rows concerned, the reads and their order are those of
  the snapshot.
- admin-cms `notificationTeardown.test.ts`: would still pass; it never reaches the DAM handle (L7).
- The only difference found: finding L3, which no consumer meets.

### 3. Lanes

- Wrong lane: none in the library. The poll goes to the lane of `configOf(queueKey)` (`:807`, `:401`), a notification
  read to the lane of its name (`:542`, `:578`) and is read by a queue of that name, a refresh or a known processed
  file to the lane of its one name (`:675`), several names being split first (`:666-672`). The unnamed lane takes only
  reads the library never makes itself (a store call without `of` from an application). An edge no caller of the
  library or the three admins reaches: a target naming one configuration twice (`['own','own']`) is not split
  (`uploadSettle.ts:232-233`), and `laneOfTarget` (`:125-126`) puts it in the unnamed lane.
- A streak left open: L1.
- Leak: `lanes` grows by distinct names (the configurations, plus any name a caller passes); each lane holds a
  settled promise and a boolean. Nothing to change.
- No lane awaits a read queued in another (`scheduleNamed` from the tick is `void`, `:360`; the original of a
  duplicate is read inside the lane, not queued).
- Without `configOf` (`laneOf` keys everything `undefined`, `:113-121`): one chain and one `failing`, set and reset at
  the same places as on the snapshot (diff read line by line); pinned by `uploadSettlementLanes.test.ts:133-163`
  (green on both).
- In the library the lanes write disjoint rows (by configuration), so two lanes never race on one row; the revision
  marks still guard the unnamed lane.

### 4. API, tests, bends, documents

- API only grows: `CommonAdminCoreDamConfig.notification?`, `addDamNotificationListener(callback, options?)` (a
  one-parameter callback still satisfies the new type), `DamNotificationListenerOptions`,
  `useDamNotificationsConnection(configName?)`, `connection.isPushAlive(queueKey?)`; `lib.ts` gains two lines, loses
  none.
- Red on the snapshot: 11 of 13 (`pracovne/impl-lib-op12/pv4-ohyb-pred.log`), each for the missing behaviour; the two
  green are the guards of a profile without `configOf`. Bends b1 (origin dropped → 3 red), b2 (the store's
  `isPushAlive` without the queue → 1), b3 (one lane → 2) do what the brief asks; gaps in L2.
- Two PV14a cases changed (`uploadNamedConfiguration.test.ts:78-80,162,203`): they emit with `['own']`. That follows
  from "an event without an origin is `default`'s" and still pins that `own`'s rows are read by `own`'s client; the
  brief's "existing notification cases unchanged" is not met to the letter, as the note says.
- Full check: browser 386 files, 5389 tests green; linty green (`vysledky/PV14c-L4-*.log`).
- Documents: L6, L7.

## Outside the step

**Low — a replaced handle disposed again marks the live sockets closed** (kept as it was).
`damNotifications.ts:101-105` with `:75-78`. After `initDamNotifications()` replaced a handle (its key changed), a
caller that still holds the old one and calls its `dispose()` runs `setDamNotificationsPushAlive(false, names)` for
names whose sockets of the new handle are open; their queues poll densely until those sockets change state. The same
happened with the one flag on the snapshot; rare (it needs a second `initDamNotifications()` with other options).
Fix: `if (disposed) return` first in the handle's `dispose`.

**Process note.** `krok5-praca/nastroje/ck-lib.sh:28` runs the library's browser suite with
`VITEST_MAX_WORKERS=${CK_WORKERS:-6}`; the global rule caps vitest at 2 workers. The PV14c-L4 run used 6
(`vysledky/PV14c-L4-testy.log:1`). Confirm it is intended.

## Verified, not verified

Verified by reading, with the places cited: the patch against the tree, every changed source file whole,
`uploadSettle.ts:206-792`, the poller and its schedule, VueUse `useEventBus` and `useWebSocket` in `node_modules`, the
consumers' options and calls, admin-cms's test and its `appInitialize.ts`, the logs of the red run, of the bends and
of the full check. Not verified: nothing was run (no mutation for L2, no browser for L5); that `new WebSocket` throws
for the addresses of L5 is taken from the WHATWG constructor steps, not tried.
