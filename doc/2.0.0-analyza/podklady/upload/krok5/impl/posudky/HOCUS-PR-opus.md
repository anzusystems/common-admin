# HOCUS-PR #1198 (bec5deb): adversarial review (Opus)

Refs are relative to HP = /home/volar/projects/anzusystems/krok5-praca/hocuspocus-pr/hocuspocus unless named.
AW = y-protocols 1.0.7 awareness.js (HP/node_modules/.pnpm); PR = hocuspocus-pr/PR.md; SUM = perf/results/main/summary.md;
CP = COLLAB-PERF.md; cx#n = finding n of posudky/hocus-pr-codex.md. V = verified (source, logs, read-only gh); NV = not verified.

**Verdict: no High.** The change is correct for standard clients and worth upstreaming. Before a maintainer looks, answer
CodeRabbit's open change request (M1) and fix the measurement wording (M2).

PR state (V, gh, 22. 10.):
- reviewDecision is CHANGES_REQUESTED by coderabbitai. Inline on MessageReceiver.ts:82-92 it asks to validate before applying
  (= M1a), plus a nit for 1-2-line comments. `.coderabbit.yaml` has request_changes_workflow: true.
- CI has not run: build run 39721470790 is `action_required`. Local runs used Node 24.15 only; CI tests 22/23. main is still
  9def046, and the open #1175 touches only extension-redis.

## Medium
**M1 (Q1) Direct apply loses disconnect cleanup for two non-standard frames, so "ends in the same awareness state"
(PR:60) is too broad.** V from source.
- (a) A malformed later entry (= CodeRabbit, cx#2). AW:249-294 applies the earlier entries and throws before emitting. Without
  an event, Document.ts:268-275 never tracks them, and `close()` (Connection.ts:287-297 → Document.ts:186-195) can't remove them.
- (b) The same client twice, null then a newer state (cx#1, confirmed). The event `{updated:[C], removed:[C]}` makes
  Document.ts:273 untrack C while it is live. The scratch path collapsed both into one live entry.
- Effect: the ghost is not broadcast, but every new connection gets it (Connection.ts:85, 228-238) until the 30 s timeout
  (AW:59-77). It needs a crafted client, and without hooks any client can already write any state. What is new is only that
  the ghost outlives the disconnect by up to 30 s.
- Reply options: `modifyAwarenessUpdate(update, s => s)` (AW:219-234) fixes (a) only, at one more decode/encode per message
  (NV: rerun bench-awareness.ts). (b) is fixable in Document.ts:273 by untracking only ids whose state is gone (NV). Or call it
  4.0 behaviour (v4.0.0 applied directly) and state the consequence in PR:66-67.

**M2 (Q4) The measurement text claims more than was measured.**
- (a) The "4.7.1 + this change" column (PR:24) is the prototype collab-next-awarefast.patch, not bec5deb. The prototype sets a
  flag once per document and spots the default no-op by identity (CP:170-186); only the micro-benchmark measured bec5deb. Under
  this load the two behave the same, so the numbers likely transfer, but the label is wrong (cx#3: Low; Medium here, headline).
- (b) "applyAwarenessUpdate + encodeAwarenessUpdate another 1.5 s" (PR:34-35) is not the scratch's cost. Hocuspocus 3 (1.14.1)
  applied directly and spent 1.42 + 0.53 s in the same functions (SUM:917, 919). The fast path still runs the document apply
  and the broadcast/Redis encodes (OutgoingMessage.ts:53; Redis.ts:548). Drop the sentence or write "part of".
- (c) Unstated: the server ran Sentry 11 with traces 1.0 (CP:14, :138; SUM:236). The 2.77-point CPU drop (SUM:760) over ~180
  awareness msgs/s is ~150 µs per message, versus 54 µs in the micro-benchmark (logy/bench.log). That 2.7× gap (n = 3) is
  unexplained. Name the instrumentation and lead with the micro-benchmark.

## Low
- **L1 (Q1, missing from cx) A third difference.** The scratch re-encode wrote `states.get(id) || null` (AW:200), which turned
  `false`/`0`/`""`/`1e400` into a removal. Applied directly, such a state is stored (AW:266-267) and appears in getStates,
  hasAwarenessStates and onAwarenessUpdate. Peers still get null (OutgoingMessage.ts:53-56), as in 4.0. V from source; not run.
- **L2 (Q1) cx's clock-0 caveat is unreachable.** It needs a stored clock-0 state. The Document's own client is at clock 1 from
  construction (Document.ts:87-88; AW:101-114), and an unknown client's clock-0 entry is never stored (AW:256), so PR:60-62
  holds. The `origin` object is identical in both paths (MessageReceiver.ts:75-80, 88, 135). V.
- **L3 (Q3) The tests pin the predicate, not the path.** Test 1 only checks that `isBeforeHandleAwarenessActive()` is false
  (tests/server/beforeHandleAwareness.ts:373). Deleting MessageReceiver.ts:87-91 would pass every test (inferred), and both mutations
  break only the predicate (logy/mutacia-m1.log:50, -m2.log:49), so PR:82 overstates. Pin it in the
  messageReceiverAwarenessClock.ts style: predicate false, a callback that must not be called, and a `getRandomValues` stub
  that counts calls (a scratch Y.Doc makes 32); expect 0. The default `isActive = () => true` (Document.ts:156) is untested.
  Test 1 does rely on the origin: the provider's disconnect sends no null state (HocuspocusProviderWebsocket.ts:520-534).
  Flakiness NV.
- **L4 (Q2) API and design.** Removing the default is type-safe (types.ts:119, 239-241), and the pushed config already carries
  `beforeHandleAwareness: undefined` (Hocuspocus.ts:122) the way onAuthenticate does. Nothing in the repo calls or defines it,
  and DirectConnection has no awareness path. Calling `some()` per message is right: Server.ts:155-159, Server.ts:229-233 and
  test 2 push extensions at runtime. It is cheap, because hooks() already filters the same array on every call
  (Hocuspocus.ts:583-585). Likely remarks: the filter is duplicated (Hocuspocus.ts:496-498 vs 585), and a `hasHook(name)`
  would remove that; replacing `callbacks` wholesale throws a TypeError per message (cx#4); a security hook set directly on
  `callbacks` silently fails open.
- **L5 (Q4) Smaller text errors.**
  - The "medians" are the upper middle value of 6 (bench-awareness.ts:83); the real medians are 4.96/58.7 µs. Also, Redis has
    no connection to close (Redis.ts:743). Both are cx#5.
  - "y-prosemirror cursors … nearly every keystroke" (PR:12) is wrong for y-prosemirror 1.3.7. It anchors the cursor to the
    next character with assoc 0 (lib.js:57, 66, 120; yjs RelativePosition.js:163-187) and writes only on a change
    (cursor-plugin.js:227-236), so typing sends nothing. Tiptap CollaborationCaret 3.32 (collaboration-caret.ts:4) does send on
    every keystroke: y-tiptap 3.0.10 uses assoc −1 (absolutePositionToRelativePosition.ts:17, 23, 86), which is what
    generatorWorker.mjs:130-133 models. Drop "y-prosemirror".
  - "biome check … nothing on the changed lines" (PR:91) is false for the test: `biome lint` reports 3 new noNonNullAssertion
    warnings at 357, 372, 397 (logy/biome-tests.log:216, 237, 249).
  - "same origin, as 4.0 did" (PR:56): 4.0 used `connection ?? null`; TransactionOrigin came in 4.1.0 (#1094,
    CHANGELOG.md:135).
- **L6 (Q5) Conventions.** bec5deb has no commit body, but upstream squash merges keep commit bodies (9def046, 52dffba, 98d5f62,
  e6b1972), so add 3–6 lines. The author email is not linked to volarname (`author.login: null`). The description runs ~95
  lines, against 5–20 for #1195/#1178/#1162. #1162 adds "reviewed before submission" to its AI note; add that if true
  (slop_detection is on). There is no CONTRIBUTING. Title, branch, files and source format are fine; biome flags only old lines
  (logy/biome.log:307-371).

## Verified correct (V)
- The commit is the tested diff (cmp-identical to awareness-fast-path.diff). #1096 is in 4.1.0 (CHANGELOG.md:130, 140). The
  scratch Awareness has a `setInterval` (AW:59) and the scratch Y.Doc calls `getRandomValues` 32 times (yjs Doc.js:60-64).
- The table's means, ± and Δ match SUM:225-244. The profile's 2.22/1.51/34.7 s match SUM:868, 943-953, and the bench matches
  logy/bench.log. Tests passed 260/18/91, the build passed, and tsc reports 213 errors before and after.
- For standard clients, clocks, null removals, clock 0, origin, cleanup and listeners agree. Redis goes through MessageReceiver
  (Redis.ts:743-744). `lerna version` inherits publish.conventionalCommits (lerna dist/commands/version/index.js:6496-6497).

NV: runtime repro of M1/L1, the cost of prevalidation, Node 22/23, external `Document.callbacks` users, maintainer preference.

Process note: a redirect of mine created /home/volar/projects/anzusystems/krok5-praca/hocuspocus-pr/posudok-tmp-check.diff, a copy
of `git diff 9def046 bec5deb`. I did not delete it (removal rule). One trivial `node -e` read yjs package.json. I ran no
install, build, test or bench.
