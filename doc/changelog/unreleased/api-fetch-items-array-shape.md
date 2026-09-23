planned
===

### Added

- **`useApiFetchItems` reads a bare array, not only an envelope.** `shape: 'array'` picks the reader;
  `'envelope'` stays the default, so nothing written against the old signature changes.

  The point is that the shape is declared and checked rather than assumed. Twenty-three call sites in
  the fleet wrote `useApiRequest<Entity[]>` and handed the answer straight to the caller as an array
  with nothing verifying that it was one — the same hole this helper was built to close for the
  envelope. All twenty-three were checked against their backends first: every one really does answer
  with a bare array, in core-cms, owl, the notification service and artemis.

  A wrong declaration therefore fails on the first run, loudly, with the url in the message, instead
  of handing back something that is not a list. That is what makes having a default safe.

  One live failure mode changes shape because of it. owl's metric endpoints answer **202 with a
  problem document** when an aggregation has not caught up — a valid status, so the body reached the
  caller typed as `MetricPoint[]` and died later as a `TypeError` inside a chart mapper, caught as a
  generic error. It is now an `AnzuApiResponseCodeError` with `code === 202`, logged, with the url,
  and a caller that wants to treat "not processed yet" as an empty chart can finally branch on it.

- **`method` and `body` on `useApiFetchItems`.** A list is not only ever the answer to a read: a
  filter too big for a url goes out as a POST, and a mutation can answer with the list it just
  changed — a swap, a shift, an upsert-all. Three of the fleet's list reads are mutations of exactly
  that kind. The helper is about what comes back, not about the verb.

  `GET` is the default and a body on a GET is refused with `AnzuFatalError` before anything is sent.
  That guard exists *because* of the default: a caller who writes a body and forgets `method: 'POST'`
  would otherwise send a GET without its filter, and nothing downstream would notice.

- **`anzu/prefer-api-fetch-items`**, error by default in `recommended()`. It reports a `useApiRequest`
  whose response type is an array (`Entity[]`, `Array<Entity>`) or a list envelope
  (`ApiResponseList<Entity[]>`, `ApiInfiniteResponseList<Entity[]>`, `{ data: Entity[] }`).

  Without it the helper covers a shrinking share of the calls: nothing stops tomorrow's code writing
  `useApiRequest<Entity[]>` again, and nobody notices for a year. A call that legitimately reads the
  envelope's metadata — pagination the user drives, which belongs on `useApiFetchList` — takes a
  per-line disable with a reason, the same way `prefer-api-command` handles a delete that really does
  answer with the deleted entity.

  A literal that spells out more than `data` (`{ data: Entity[]; hasNextPage: boolean }`) is *not*
  reported: writing those fields out is the author saying they read them.

  This library's own three sites moved over in the same change that added the rule, so the gate does
  not open by exempting the library that wrote it.
