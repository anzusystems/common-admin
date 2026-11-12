# HOCUS-PR2: overenie 2. kola PR #1198 (Claude Opus, len čítanie)

Uložené vedúcim zo správy recenzenta (recenzent nemal nástroj na zápis). Ran no installs/builds/tests (one tiny `node -e` JSON check only).

Paths: clone = /home/volar/projects/anzusystems/krok5-praca/hocuspocus-pr/hocuspocus ; MR = packages/server/src/MessageReceiver.ts ; DOC = packages/server/src/Document.ts ; HP = packages/server/src/Hocuspocus.ts ; AW = node_modules/.pnpm/y-protocols@1.0.7_yjs@13.6.29/node_modules/y-protocols/awareness.js ; TEST = tests/server/messageReceiverAwareness.ts.

## Earlier findings
- M1a / cx#2 / CodeRabbit (malformed partial-apply ghost): RESOLVED. isPlainAwarenessUpdate (MR:33-51) fully decodes+JSON.parses every entry before MR:113 applies anything; a truncated/bad-JSON entry throws there, so document.awareness is never touched (also fixes the Redis no-connection path). Same decode sequence as AW:249-252, so nothing that passes the check can throw later in applyAwarenessUpdate. Test TEST:93-102, mutation MB fails it (logy/mutacia2-mb.log:5-6).
- M1b / cx#1 (same client twice escapes disconnect cleanup): RESOLVED. Duplicate clientId -> isPlainAwarenessUpdate returns false (MR:43) -> scratch path collapses [null,{state}] to one `added`, so the connection tracks it (DOC:272) and removeConnection clears it. TEST:104-136; mutation MB fails "a new client is tracked".
- M2a / cx#3 (prototype vs real change): PARTLY. Micro-benchmark measures the submitted code (6.2µs incl. ~1.5µs check). End-to-end numbers are TODO placeholders (PR.md:19,31,34,35); build-471.sh rebuilds v4.7.1 + the exact diff. Resolves on fill.
- M2b (profile "+1.5s in apply/encode"): RESOLVED — sentence gone.
- M2c (instrumentation): PARTLY — Sentry 11.8 tracing 1.0 disclosed (PR.md:31); µs-per-msg gap note TODO (PR.md:35).
- L1 (falsy / third difference): RESOLVED/disclosed. false/0/"" rejected (MR:43), tested (TEST:138-148); non-round-trip numbers inside objects disclosed (PR.md:12); peers get identical bytes (AW:204).
- L2 (clock-0): NOT APPLICABLE — no claim; clock 0, equal-clock null, never-seen-null, own clientID end identically on both paths.
- L3 (tests pinned predicate not path): RESOLVED. TEST:52-77 getRandomValues spy, callback t.fail, origin identity; mutation MA fails it.
- L4 / cx#4 (direct document.callbacks users): disclosed PR.md:13; acceptable.
- L5 / cx#5: biome RESOLVED on changed lines; medians are true medians (6.2/57.8); "connection closed either way" and y-prosemirror claims gone.
- L6 (conventions): RESOLVED — commit body present.
- CodeRabbit inline: RESOLVED differently (isPlainAwarenessUpdate); reply explains why modifyAwarenessUpdate is insufficient. Nitpick: RESOLVED (2-line comment, MR:107-108).
- Document.ts:273 unchanged: reasoning SOUND. Null-then-reappear ghost across separate updates is a pre-existing upstream bug on both paths.

## isPlainAwarenessUpdate correctness
Accepts single-per-client entries with null or any object (nested objects, arrays round-trip identically). Rejects -> scratch: duplicate client, non-object state. Throws -> connection closed, document untouched: malformed/truncated/bad-JSON/huge-varuint. Empty update: no-op on both. Trailing bytes ignored by both. Update bytes not mutated by the check. Redis path -> fast path, same result, now safe against a malformed relay.

## New findings
No new High or Medium.
- L-new1 (process): PR.md TODO placeholders and CODERABBIT-REPLY.md `COMMIT_SHA` must be filled before posting.
- L-new2 (Low, cosmetic): round-2 commit typed `fix(server):` on top of `perf(server):`; on rebase-merge it would add a spurious Bug Fixes changelog line. Consider `perf(server):`.

## Tests / build (from logs, not re-run)
tests/server 265 on Node 24.15 and 22.23; extension-redis 18; others 91; tsc 213 before/after; all four mutations fail; new tests deterministic; tested tree = tree to be committed.

VERDICT: safe to commit and push once the TODOs and COMMIT_SHA are filled.
