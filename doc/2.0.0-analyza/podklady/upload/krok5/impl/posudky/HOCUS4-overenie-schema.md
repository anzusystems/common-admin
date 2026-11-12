# HOCUS4: schema parity, collaboration server vs admin-cms article body editor

Scope: collaboration `next` 7262b58 (C = `/home/volar/projects/petit/collaboration`), admin-cms `next` 5da04120b
(A = `/home/volar/projects/petit/admin-cms`). Both use tiptap 3.32.0, with no nested copies of @tiptap/* or prosemirror-model
(one prosemirror-model 1.25.12 in each tree).

## Verdict

- **The two schemas match completely in what they store.** Both have 43 nodes and 8 marks with the same names. Every attribute
  the cms editor has also exists on the server, so `toYdoc` drops nothing today. There are no High findings.
- Four differences remain, all in custom sources and all Low: two attribute defaults (`button.external`, `link.external`), the
  order inside one content expression (`styledBoxContent`), and `link.inclusive`. Two more facts belong to the cms side only: the
  `icon` node exists in the cms only for one site group, and the schema order of some nodes differs.
- **None of these differences came with tiptap 3.32.** The custom sources on the server have not changed since 7e2f1a4
  (`git diff 8a13987 HEAD -- src/tiptap` is empty). The lines on the cms side are dated between 2024-10 and 2026-07.
- **The one stock difference existed before and the upgrade closes it.** `tableCell.align` and `tableHeader.align` arrived in
  @tiptap/extension-table 3.22.0. The cms has had them since 2026-04-09; the server on 3.19.0 did not have them. In production
  (cms master on 3.30.6, server master and develop on 3.19.0), a cell alignment that came in by paste was silently dropped when a
  collaboration started.
- **Nothing guards against schema drift between cms and server.** Details are under "Guards".

## How a mismatch actually behaves (server side)

The JSON that goes into `toYdoc` is the room data (`C/src/server/document/fetchDocument.ts:26-33`). The moderator's client
gathers it (`C/src/manager/roomUserManager.ts:268`, common-admin `src/domains/collab/composables/collabState.ts:38-48`). For the
body, it is the cms editor's own `getJSON()` (`A/src/domains/cms/article/components/bodyEditor/ArticleBodyEditor.vue:173-183`).
ProseMirror `toJSON` writes every attribute, so this JSON always carries all attributes of the **cms** schema explicitly.

`TiptapTransformer.toYdoc` calls `prosemirrorJSONToYDoc`, which calls `Node.fromJSON(serverSchema, json)`
(`C/node_modules/y-prosemirror/dist/y-prosemirror.cjs:1671-1673`). In `C/node_modules/prosemirror-model/dist/index.cjs`:
- **Unknown node or mark:** it throws RangeError (`nodeType` at 2007-2010, `Mark.fromJSON` at 422). The fetch fails and the
  collaboration does not open. This is loud, not silent.
- **Unknown attribute:** it is silently dropped. `_computeAttrs` (1697-1709) copies only the type's own attributes, and the Y.Doc,
  then Mongo, then the article that the cms saves next all go on without it.
- **Missing attribute:** the server fills in its own default. This path is not reachable today, because the cms JSON is complete.
- **Content expression:** `create` does not check it. Only the validate endpoint checks it (`validContent`, which does not depend
  on order).

## Differences (current state, ranked by consequence)

| # | Rank | What | Server (C) | cms (A) | Consequence | Since |
|---|---|---|---|---|---|---|
| D1 | Low | `button.external` default | `false` at `src/tiptap/nodes/Button.ts:21-22` | `true` at `src/domains/cms/shared/components/anzutap/nodes/button/button.ts:70-71` | No effect through `toYdoc`, because the cms JSON always carries `external`. It is latent: JSON without `external` from any other producer would come out `false` in collab mode and `true` in plain mode. The backend treats a missing value as `false` (core-cms `vendor/anzusystems/anzutap-bundle/src/Model/Node/ButtonNode.php:29`), so here the cms is the odd one out. | C fb57ccfa 2023-08-17, A e0c38b34d8 2024-10-23 |
| D2 | Low | `link.external` default | `false` at `src/tiptap/marks/Link.ts:52-53` | `true` at `.../anzutap/marks/link/link.ts:293-294` | Same as D1. The backend link transformer always sets the value (`LinkNodeTransformer.php:84-86`), and `Link.php:57` reads a missing value as `false`. | same commits |
| D3 | Low | `link.inclusive` | `false` (`Link.ts:22-23`, `autolink: false` at :30) | `true` (`link.ts:251-252`, `autolink: true` at :259) | It is not stored and only affects typing at the edge of a mark. The server never edits, so it has no effect. | C 5d2ceb70 2024-08-27, A 5a5c8beda4 2025-01-06 |
| D4 | Low | `styledBoxContent` content | `(list \| paragraph)+` at `src/tiptap/nodes/StyledBoxContent.ts:5` | `(paragraph \| list)+` at `.../nodes/styledBox/styledBoxContent.ts:10` | Both accept the same content. Order matters only for `ContentMatch.defaultType` (fill and `clearNodes`), which the server never runs, so neither `toYdoc` nor the validate endpoint is affected. Aligning it is a consistency fix only. | cms changed it in f11e11618 2026-07-27, which is also on master |
| D5 | Low (cms only) | `icon` node and `styledBoxTitle` content | `Icon` always registered (`src/tiptap/cmsArticleBodyExtensions.ts:96`), title `(text \| icon)*` (`StyledBoxTitle.ts:5`) | `Icon` only when `siteGroup === envConfig.editorIcons.siteGroup` (`src/domains/cms/article/composables/articleBodyExtensions.ts:282-284`), title `text*` otherwise (`styledBoxTitle.ts:14-15`, set at `articleBodyExtensions.ts:254`) | The server has more than the cms, so `toYdoc` loses nothing. The risk is all on the cms side: a body that contains an icon, opened under another site group, fails in the cms itself. In plain mode it raises `onContentError` (`ArticleBodyEditor.vue:162-165`). In collab mode, y-tiptap 3.0.10 sets a projection error and filters out transactions that change the document (`A/node_modules/@tiptap/y-tiptap/dist/index.cjs:1477-1497, 1810`). It blocks editing but deletes nothing. | A 17ae7abd4f 2026-01-28 |
| D6 | Info | Node order in the schema | `quoteContent, quoteAuthor, quote, …, icon` after `button`, `embedDangerBox` after `contentBreak` | `quote, quoteContent, quoteAuthor, …`, `embedDangerBox` after `embedCrossBox`, `icon` last | No effect. The default type of `doc` is `paragraph` on both sides, and the server never fills content. | n/a |

### Resolved by the upgrade (existed before 3.32)

| # | Rank then | What | Evidence | Consequence then and now |
|---|---|---|---|---|
| R1 | High in production | `tableCell.align` and `tableHeader.align` (stock, default `null`) | Created by `createAlignAttribute()` in `C/node_modules/@tiptap/extension-table/dist/cell/index.cjs:116` and `header/index.cjs:116`, parsed from `style="text-align"` or the legacy `align` attribute (`cell/index.cjs:15-27`). Absent in 3.19.0, 3.20.6 and 3.21.0, present from 3.22.0 (each checked with `npm pack`). The cms uses the stock cells (`articleBodyExtensions.ts:14, 212-215`) and has been on ≥3.22 since 3b49a7389 (2026-04-09, extension-table 3.22.3), which is in origin/master. The server stayed on 3.19.0 (origin/master and origin/develop). | A cell alignment that came with pasted HTML was dropped by `toYdoc` when a collaboration started, and the cms then saved the body without it. The cms toolbar never sets `align` (no `setCellAttribute` in A/src), so paste is the only source. 7262b58 (server on 3.32.0) closes it once the server is deployed. Deploying cms `next` alone changes nothing, because stock 3.30.6 and 3.32.0 give identical schemas. Mongo Y.Docs are per session (`C/src/manager/roomDataManager.ts:44`), so nothing stale carries over. Alignments already lost are not restored. |

Stock changes between server 3.19.0 and 3.32.0, from the full dump of the server extension set run on both versions: only R1.
Between 3.30.6 (cms production) and 3.32.0: none.

## Guards

- **The validate endpoint uses the server's own schema** (`C/src/server/document/onRequestHook.ts:14, 21, 34-36`), so it cannot
  see cms-versus-server drift.
  - It cannot see attribute loss either: `Node.fromJSON` has already dropped unknown attributes before `check()` runs.
  - It overrides `Node.prototype.check` (`C/src/command/articleValidator/pmModelOverride.ts:9-27`) without `checkAttrs`. The
    original check calls it at `prosemirror-model/dist/index.cjs:1161`.
  - Its only caller is the Artemis migration in core-cms (`src/Domain/Migration/Controller/Api/Sys/V1/SchemaValidationController.php:32-40`).
    The cms editor never calls it.
- **The cms checks content against its own schema only.**
  - `useAnzutapDebug` runs `getSchema(cms extensions)` and `Node.fromJSON(...).check()`
    (`A/src/domains/cms/shared/components/anzutap/composables/anzutapDebug.ts:9, 46-57`), called at `ArticleBodyEditor.vue:89-90`.
  - `enableContentCheck: true` and `onContentError` are set at `ArticleBodyEditor.vue:131, 162-165`.
  - Neither of these knows the server schema.
- **No test or script in either repo compares the two schemas.** That gap is how R1 went unnoticed for about six months. The
  dump scripts used here (below) are a ready base for a parity check in CI: dump both schemas, then fail on any missing
  node, mark or attribute, any default that differs, or any content that differs.

## Method

1. **Server.** `getSchema(cmsArticleBodyExtensions)` was run from `C/dist` (built 2026-10-21 10:27, after the last change in
   `src/tiptap`). The dump records group, content, marks, inline and atom flags, isolating, defining and every attribute with its
   default. The same dump was repeated with the stock packages swapped for the `npm pack` tarballs of 3.19.0 and 3.30.6, through
   a resolver hook, to get the stock deltas.
2. **cms.** The real `useArticleBodyExtensions` was bundled with esbuild from `A/node_modules`, so every extension,
   `.configure()`, `.extend()` and `addGlobalAttributes` is the real one. Only `.vue` files, CSS and non-tiptap packages (vue,
   pinia, vue-i18n, common-admin and so on) were stubbed, under happy-dom. It ran once with the icon site group and once without,
   then went through the same `getSchema` dump. No stubbed value reached the schema (checked: no `__stub__` value in the output),
   and every field not listed above is identical to the real server dump.
   - Collaboration, CollaborationCaret and UndoRedo, which `ArticleBodyEditor.vue:96-115` adds, contribute no schema.
   - `ArticleBodyEditor` is the only Hocuspocus client (`grep useHocuspocus`).
3. **Comparison.** A script compared the dumps field by field.

Artifacts are in the scratchpad `/tmp/claude-1000/-home-volar-projects-anzusystems-common-admin/2cf91bcd-ff9f-4776-a8b6-8682baecf8fb/scratchpad/schema/`.
The scripts are `dumpServerSchema.cjs`, `buildCms.cjs`, `cmsEntry.ts`, `runCms.cjs`, `runServerOld.cjs` and `compare.cjs`. The
output JSON files are `server-schema.json`, `server-schema-3.19.0.json`, `server-schema-3.30.6.json`, `cms-schema-icons.json` and
`cms-schema-noicons.json`. `/tmp` is wiped if WSL restarts, so copy them out if a CI check should be built on them.

Not verified:
- live documents (how often pasted cell alignment actually occurred, or whether a body has icons under another site group);
- other room-data producers besides the cms editor;
- that the stubbed run matches the browser for options computed from stubbed modules. None of the schema fields depends on
  them, apart from `allowIcons` and `Icon`, which come from the real `envConfig` and were tested both ways.

## Appendix: full inventory (server schema; last column compares the cms schema with icons)

| Node | group | content | marks | inline/atom | attrs = default (server) | cms same? |
|---|---|---|---|---|---|---|
| styledBox | embed | `styledBoxTitle styledBoxContent` | "" | block | variant="summary" | yes |
| paragraph | block | `inline*` | – | block | anchor=null, textAlign="left" | yes |
| doc | – | `(block \| lock \| embed \| embedImage)*` | – | block | – | yes |
| text | inline | `–` | – | inline | – | yes |
| hardBreak | inline | `–` | – | inline | – | yes |
| quoteContent | – | `text*` | "" | block | – | yes |
| quoteAuthor | – | `text*` | "" | block | – | yes |
| quote | embed | `quoteContent quoteAuthor` | "" | block | – | yes |
| heading | block | `inline*` | – | block | anchor=null, level=1, textAlign="left" | yes |
| orderedList | block list | `listItem+` | – | block | start=1, type=null | yes |
| bulletList | block list | `listItem+` | – | block | – | yes |
| listItem | – | `paragraph block*` | – | block | – | yes |
| horizontalRule | block | `–` | – | block | – | yes |
| table | block | `tableRow+` | – | block | caption="", variant="default" | yes |
| tableRow | – | `(tableCell \| tableHeader)*` | – | block | – | yes |
| tableHeader | – | `block+` | – | block | align=null, colspan=1, colwidth=null, rowspan=1 | yes (align absent on server 3.19.0) |
| tableCell | – | `paragraph+` | – | block | align=null, colspan=1, colwidth=null, rowspan=1 | yes (align absent on server 3.19.0) |
| contentLock | lock | `–` | "" | block | – | yes |
| embedImage | embedImage | `–` | "" | block | changeId="", id=null | yes |
| embedRelated | embed | `–` | "" | block | changeId="", id=null | yes |
| button | embed | `inline*` | "" | block | external=false, href=null, internal=null, nofollow=false, size="small", variant="link" | NO, cms external=true (D1) |
| icon | inline | `–` | "" | inline/atom | group="", name="", ratio="1x1", title="" | yes (cms: only in the icon site group, D5) |
| contentBreak | embed | `–` | "" | block | – | yes |
| embedDangerBox | embed | `–` | "" | block | changeId="", id=null | yes |
| embedReview | embed | `–` | "" | block | changeId="", id=null | yes |
| embedQuiz | embed | `–` | "" | block | changeId="", id=null | yes |
| embedPoll | embed | `–` | "" | block | changeId="", id=null | yes |
| embedLiveBlog | embed | `–` | "" | block | changeId="", id=null | yes |
| embedGallery | embed | `–` | "" | block | changeId="", id=null | yes |
| embedCrossBox | embed | `–` | "" | block | changeId="", id=null | yes |
| embedExternal | embed | `–` | "" | block | changeId="", id=null | yes |
| embedVideo | embed | `–` | "" | block | changeId="", id=null | yes |
| embedAudio | embed | `–` | "" | block | changeId="", id=null | yes |
| embedCustom | embed | `–` | "" | block | changeId="", id=null | yes |
| embedExternalImage | embed | `–` | "" | block | changeId="", id=null | yes |
| embedExternalImageInline | inline | `–` | "" | inline | changeId="", id=null | yes |
| embedImageInline | inline | `–` | "" | inline | changeId="", id=null | yes |
| embedWeather | embed | `–` | "" | block | changeId="", id=null | yes |
| embedElection | embed | `–` | "" | block | changeId="", id=null | yes |
| embedTimeline | embed | `–` | "" | block | changeId="", id=null | yes |
| embedFaq | embed | `–` | "" | block | changeId="", id=null | yes |
| styledBoxTitle | – | `(text \| icon)*` | "" | block | – | yes with icons; cms without icons `text*` (D5) |
| styledBoxContent | – | `(list \| paragraph)+` | "" | block | – | NO, cms `(paragraph \| list)+` (D4) |

| Mark | inclusive | excludes | attrs = default (server) | cms same? |
|---|---|---|---|---|
| link | false | – | external=false, href=null, internal=null, nofollow=false, variant="link" | NO, cms inclusive=true (D3), external=true (D2) |
| bold | – | – | – | yes |
| italic | – | – | – | yes |
| underline | – | – | – | yes |
| strike | – | – | – | yes |
| superscript | – | – | – | yes |
| subscript | – | – | – | yes (the server uses its own `src/tiptap/marks/Subscript.ts`, the cms the stock one; the schema is the same) |
| comment | false | – | id=null | yes |

The server has `src/tiptap/nodes/EmbedNewsletter.ts`, but nothing registers it. The cms article body does not register
`embedNewsletter` either, so it has no effect.
