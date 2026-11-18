# Overenie opráv B2 – Opus (deep-reviewer), pracovný strom nad collaboration d7fe2f7 + admin-cms test

## PART 1/2: verdict, fixes 1-4

VERDICT:
- Fixes 1-4 resolve what they target (Opus M1, M2, L1, L2; Codex H1, H2, M3). They add no High or Medium regression.
- Fix 5 handles the trailing node correctly and cheaply. But its test proves less than §11.2 says (see Part 2). With minEditOps 1, other editor fixes made while it renders the body still mark a user who never typed as `edited`. That is narrow and depends on the body content.
- One Low side effect of fix 2: memory.

1. Hot path: resolved.
- Before mayStore, only the HGET of data:<room> on the main client remains (`getStoredData`, collabStatsEditManager.ts:291-296).
  - For a change it runs alongside getLock, inside the room lock (changeFieldDataListener.ts:46).
  - For a release it is sent before releaseLock on the same main connection (releaseFieldLockListener.ts:69). Its reply comes back before releaseLock's replies, so `await before` (:87) adds no wait.
- The baseline is read after the answer, not awaited, only when that HGET returned null, and its errors are swallowed (collabStatsEditManager.ts:321-327).
- So a stuck stats client delays neither the store, the ack, the broadcast nor the room lock. The release's window with the lock already free is back to its pre-B2 size, so Codex H1 is gone.
- What is lost: the first write of a field during a stall is not counted (documented in §11.6).

2. Change and release of one value: resolved.
- mayStore(value) stores the socket's last value and hands back the one before it as storedBefore (fieldWriteOrder.ts:27-35). recordFieldWrite checks that first (collabStatsEditManager.ts:316).
- Both orders give 1 edit: the release stores first, so the change is superseded; the change stores first, so the release matches storedBefore.
- Undercounts only as documented: a socket that puts back its own earlier value after another user's change, and a value remembered even though its HSET failed.
- Memory (Low): writes.value keeps the last value per socket × room × field for the socket's lifetime (a WeakMap, freed on disconnect).
  - Kept in every room, and also with COLLAB_STATS_ENABLED=false, because mayStore stores it unconditionally (:27-31). The off switch is therefore no longer complete.
  - Normal use: kilobytes. A client writing many distinct field names with values near 1 MB can grow the pod's heap.
  - Keeping it only for fields the stats count would avoid both.

3. Baseline at start: resolved.
- Guards: try/catch around separate and record inside the socket.io callback (roomUserManager.ts:296-304), and inside recordFieldBase (collabStatsEditManager.ts:258-285).
- Pairs go as one array; ioredis flattens it (ioredis/built/Command.js:45), no spread.
- Cap: over 200 fields or 64 KB the baseline is dropped with a damped warn.
- The Lua runs on every start, an empty list deletes the old baseline (collabStatsRedis.ts:324-330), fixes Codex M3.
- storeAllData always runs, nothing on the start path waits for the stats.
- Residual: with the stats client down at start, the old baseline is not deleted. Harmless (later baseline reads fail too).

4. Field names: resolved.
- countedFieldName accepts only a string of at most 200 characters that passes isWellFormed (collabStatsEditManager.ts:30-31); isWellFormed exists on Node 24.
- It gates readFieldBefore, recordFieldWrite and recordFieldBase; recordEdit only through those. No bad name reaches the flush JSON.

## PART 2/2: fix 5 (body)

Test fidelity:
- The editor is built as ArticleBodyEditor builds it in collaboration: the same useArticleBodyExtensions, Collaboration on the Y.Doc, CollaborationCaret, rendered by EditorContent (node views included).
- Differences write nothing: disableIndividualEmbedFetch (fetch only fills the registry, defineEmbed.ts:132-150); isModerator only gates grammar (grammarSuggestionExtension.ts:694); enableContentCheck missing, its plugin only filters (extension-collaboration dist/index.js:181-203).
- TipTap 3.32 mounts the view in the constructor (core dist/index.js:6538, :6607), so in production the editor binds before the sync (the test's first mode). "Synced before bind" cannot happen with this component (its Y.Doc is new and empty).

What the test does not prove:
- "Open without typing = 0 updates" holds only because the test sends no transaction between the sync and the typed character.
- y-tiptap 3.0.10 writes every change that exists only in ProseMirror on the next view update of any kind (y-tiptap dist/index.js:1840-1859).
- The caret plugin sends such an update on every awareness change, including the other user's cursor, and on focus (:432-433, :443-452, :324).
- So in a real session the trailing paragraph reaches Y right after the body opens, not "with the first change" (§11.2). The server rule still catches it (first update of the connection).

Server rule: correct and cheap.
- One WeakSet lookup per update, decode only of a connection's first update of at most 256 B, inside try/catch (collabStatsExtension.ts:11-30, :50-54).
- Ignores only one empty paragraph with its own attributes and no deletion, as the connection's first change; the only real edit it can drop is such a lone empty paragraph, once per connection or reconnect.
- Text, marks, deletions, a second paragraph and attribute changes on existing nodes all count. Per connection costs nothing extra.

Anchor risk: real, but narrow.
- Other appendTransaction plugins run on the render and are flushed by the same first view update:
  - anchorExtension.ts:198-222 nulls duplicate or empty anchors on any document-changing transaction, the render is one;
  - admin-cms autolink (autolink.ts:56-85, :141) links a bare URL that ends the first text block; y-sync sets no preventAutolink.
- Then the connection's first update holds attribute or mark changes, isTrailingParagraph is false, and it counts as a body edit. With minEditOps 1 that participant (often a reader) is `edited`; with another editor within 5 min the session becomes realCollab.
- Needs content the editor never saves itself: duplicate/empty anchors (setAnchor refuses duplicates) or a bare URL ending the first block (imported or pasted text).
- Not tested: no such body, no focus or awareness step.
- Severity: Medium if such bodies exist in production (content not checked), otherwise Low.
- Cheapest check: add those two bodies and an awareness or focus dispatch to articleBodyCollabOpen.test.ts.
- Server option: also ignore a connection's first update when it adds no text.
