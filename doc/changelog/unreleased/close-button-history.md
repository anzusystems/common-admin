planned
===

### Removed

- **`stepsBack` on `AActionCloseButtonHistory` and in `NavigateBackOptions`, and `getRouteBack` /
  `getFirstRouteNotMatching` from `useRouteHistory()`.** **Breaking.** `navigateBack` had two ways to
  pick a destination: walk the history by name, or take the entry N positions back. Only the first
  ever had a user, and the second is the shape a silent no-op lived in — "N entries back" says
  nothing when a cancelled guard, a repeat visit or the ten-slot cap can each shift what sits there.
  There is one walk now, and the two helpers behind it stay internal: reached directly they hand
  back the walk WITHOUT the current-route exclusion, which is the whole trap `navigateBack` closes.

  Callers passing `steps-back` should pass `skip-route-names` instead, naming the sibling views of
  the record being closed. A caller destructuring either helper should call `navigateBack`.

### Changed

- **`addLabel` takes a ready string instead of a translation key**, on `AListEditor`,
  `ASortableListEditor` and `ANestedSortableListEditor`. **Breaking, and the compiler will not find
  it.** It was the one text prop of the three that ran through `t()` while `title`, `emptyTitle` and
  `unsavedSectionLabel` beside it took a ready string; nothing typed the difference, so a key passed
  by habit rendered as the key. Pass `:add-label="t('…')"`. Two details: the type is unchanged, so
  an unmigrated call site renders the raw key with no error; and the fallback is now `??` rather
  than a truthiness check, so `:add-label="''"` renders an empty label instead of the default.

- **`compactField` reads a dotted path.** `texts.title` — the shape most entities carry their label
  in — no longer needs an `#item-compact` slot for one field. A flat key behaves exactly as before,
  and a path that runs into `null` or a non-object renders empty rather than throwing.

- **`AActionCloseButtonHistory` defaults `skipRouteNames` to an empty list** rather than leaving it
  unset, so a button with nothing to skip beyond its own route still walks back by name.

### Added

- **`disableUnsaved` on `ASortableListEditor`**, mirroring the prop `AListEditor` already had. For a
  list that is a VIEW of data owned elsewhere — a display cache rebuilt from a parent's field —
  nothing in such a component can ever clear an amber row, so it must not raise one: a deferred
  delete tombstones a key that never comes back, and a row arriving after the once-only baseline
  reads as an addition for the life of the mount.

- **A steering notice on `AActionCloseButton`.** It is not superseded by the history variant and is
  not the same thing: `fallbackRouteName` fires only when the history offers nothing, while this one
  goes where it is told however the view was reached. The notice reaches the generated declarations.

### Fixed

- **`navigateBack` never hands back the route the caller is on.** The history is filled from a
  `beforeEach` guard, which records the route being LEFT — and that guard also runs for a navigation
  a later guard cancels, so the route the user never left is the last entry often enough to matter.
  Pushing it again resolves to nothing: no error, no log, a close button that visibly does not work.
  Callers no longer need to name their own route in `skipRouteNames`.

  The rejection sits inside the walk rather than filtering its result. A route name is optional in
  vue-router, so a nameless current route can only be recognised by its path — testing that after
  the walk stopped it at the nameless entry, threw the result away, and never reached a perfectly
  good older destination one line further back. Names are compared with `===`, so a symbol name
  counts, and only when the current route has one: two different nameless routes are both
  `undefined` and are not the same place.

- **`useRouteHistory` documents three things it never said:** `MAX_HISTORY` drops only CONSECUTIVE
  duplicates, so a user bouncing between two views can push the entry they want out of the window;
  `setBlacklistedRoutes` replaces rather than appends (`addBlacklistedRoute` adds one); and the
  history is module state, which a test has to clear after itself.
