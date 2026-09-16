planned
===

### Deprecated

- **`ASortable` and `ASortableNested`.** Use `ASortableListEditor` from
  `@anzusystems/common-admin/labs`: it carries the same drag-and-drop reorder plus arrow controls for
  touch, an unsaved-changes baseline and row-level validation, none of which these two have. Until now
  there was no signal at all — no `@deprecated`, no note, and the playground showed them beside the
  replacement as equals. Both are now marked in the generated declarations, so consumers see it on
  hover, and the playground view says so.

### Fixed

- **Locale messages were never precompiled.** `include: 'src/locales/**.json'` matched nothing in either
  Vite config: `**` inside a path segment degrades to `*`, and every message file sits a directory below.
  The messages shipped as raw JSON for consumers to compile in the browser.

  The documented `'src/locales/**'` is not the fix — it also matches `src/locales/sk.ts`, which the
  plugin then treats as a message resource, dropping its imports and spreads while the build stays green.
  The glob is `'src/locales/**/*.json'`.

  **Consumers now receive precompiled message ASTs.** Verified against admin-blog built against this
  library: the aggregator spreads still resolve, mixed with the app's own plain messages —
  `common.button.close`, `common.sortable.close`, `error.apiTimedOut.message` and a locally merged key
  all return their text.
- `common.system.version` read `"version"` in English, where sk has `"Verzia"` and cs `"Verze"`. It
  labels the version number in admin-dam's login and close-page views and in admin-cms' settings page.
- The playground had no `@layer` declaration although it mounts Vuetify, so the cascade order was left
  to import order. It declares the same five layers the admins do.
- `logs` in `.gitignore` was unanchored, so it matched a directory of that name at any depth. It is
  `/logs`.
