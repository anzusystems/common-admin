# Anzutap

- based on [Tiptap](https://github.com/ueberdosis/tiptap) (Tiptap is based on [ProseMirror](https://github.com/ProseMirror/prosemirror))
- everything here in embeds section is used in admin-cms and not available in [admin-dam](https://github.com/anzusystems/admin-dam), admin-dam has only minimal anzutap (bold, italic, underline, link) without embeds
- the editor code is not in common-admin: it lives in admin-cms `src/domains/cms/shared/components/anzutap` (tiptap 3.31.3), each entity configures its own editor in `src/domains/cms/<entity>/composables/*Extensions.ts`

## Limitations
- on paste, embeds on top level of pasted content are cloned (new embed with new id), nested embeds (e.g. inline embeds inside paragraph) are not
- cloning runs on paste only, drag & drop moves the embed without cloning
- an embed that fails to clone is removed from the pasted content (error alert)

## Missing embeds or unknown features
- footnotes (zlaty fond)
- flourish browse

## Contents

- [Nodes](nodes/README.md)
- [Marks](marks.md)
- [Extensions](extensions.md)
- [Scraper](scraper/README.md) — embedExternal types, params and data
