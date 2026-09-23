planned
===

### Changed

- **The bookmark dialog's manage tab is a list editor.** It was the last `ASortable` in the library
  outside the playground, carrying a hand-rolled inline rename beside it — its own held copy of the
  row, its own vuelidate instance, its own confirm and cancel buttons. It is an `ASortableListEditor`
  now, so renaming, reordering and deleting behave the way they do in every other list in the fleet.

  Three things a user will notice. The dialog's own button saves the whole tab, rather than each
  rename saving itself as it is confirmed. Deleting waits for that button too — a row leaves the
  list at once, but nothing reaches the server until the save, so a delete can be abandoned by
  closing the dialog. And leaving with any of it pending asks first, instead of dropping it.

### Fixed

- **A rename typed into the manage tab could be lost, in several ways.** The per-row save reloaded
  the list to re-baseline the saved row, and the reload replaced the array a pending reorder and any
  other open row's text lived in. That reload is gone: one save, one refresh, at one moment.

- **A save that fails part way no longer takes the rest of the work with it.** Nothing is refetched
  on failure — what was written already looks on screen the way it looks on the server, and what was
  not is still the user's to correct and send again. Pressing save a second time is safe: a delete
  that went through drops its pending deletion as it goes, and a delete answered `404` is read as
  "already gone", which is what a lost response looks like on the next attempt.

- **The dialog no longer takes input while it is writing, and cannot be closed over a write.** The
  change set is read when the button is pressed, so anything typed after that was not in it and was
  overwritten by the refresh at the end; and the toolbar's close and the escape key reached the model
  without passing anything the write phase disabled, so the guard asked whether to discard work that
  was already on its way and then wrote it whatever the answer was.

- **A bookmark created on the add tab no longer lands on a position another one already holds.** Its
  position came from the number of existing rows, while the manage tab's save renumbers only the rows
  it sends — so a row created while another was pending deletion left a gap behind, and from then on
  the count was lower than the highest position in use. The list is ordered by position alone, with
  no second key, so two rows sharing one have no defined order between them; with more than one
  deletion the newer bookmark sorted ahead of an older one. A new bookmark now goes after the highest
  position in use, which is read from the same request that counts them.

- **The bookmark store stops handing out the array it caches.** `addOne` pushes into that array so a
  filter bar already on screen picks up a new bookmark at once — and it was also the manage editor's
  model, where the pushed row read as a line the user had added and never saved: an unsaved-changes
  prompt after the most ordinary action the dialog has.

- **A failed bookmark fetch is told apart from an empty list.** It answered with an empty array and a
  flag shared with every other request the store serves, so a failure blanked a list the server still
  had, and a failed count from one call could mark another call's good answer as failed. Each request
  now answers for itself, and a failure on the first load says so instead of showing an empty editor.

- **Only the newest answer per key lands.** The dialog asks for a refresh on every entry to the
  manage tab and the tabs switch faster than a request returns, so an older answer could overwrite a
  newer one — in the editor and in the cache the filter bar reads. A write straight into the cache
  counts as an answer of its own, so a bookmark created while a refresh was in flight is no longer
  undone by it.
