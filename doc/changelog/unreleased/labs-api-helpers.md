planned
===

### Changed

- **The labs api helpers answer what their type says.** **Breaking, and the compiler finds most of
  it.** `executeRequest` and `executeFetch` are both `execute`; `abortRequest` and `abortFetch` are
  both `abort`; the request body is `body`, not `object`; and the list helpers take the item type, so
  `useApiFetchList<Author>` answers `Promise<Author[]>` where it used to be written `<Author[]>`.

  The substance is what a response now means:

  - **`useApiRequest<R, B>`** is for an endpoint that always answers with a body. One that does not
    has broken its contract and fails like any other error, instead of handing back `undefined`
    typed as the entity. `R` cannot be `void`, `null` or `undefined`.
  - **`useApiCommand<B>`** is new, for a call that reads nothing back — a delete, or one that only
    starts work. Any success resolves.
  - **`allowEmpty: true`** is for an endpoint documented to answer either way; it resolves
    `R | undefined` and the caller narrows.

  Every `useApiRequest<void, …>` stops compiling and becomes `useApiCommand`. What the type cannot
  reach — a delete typed as returning the deleted entity, `any`, `never`, or no type argument —
  the new `anzu/prefer-api-command` rule reports.

- **A body is detected by what arrived, not by whether it is truthy.** `0` and `false` are bodies and
  used to be read as nothing. `''` is not a body: axios answers `''` for a 204 and for an empty 200
  alike, so it is the absence sentinel rather than a document. `null` counts as absence too.

- **A list needs an array.** `{ totalCount: 1 }` with no `data` used to pass as a list and hand back
  `undefined`. Metadata now only picks the mode and is optional — a well-formed array is not
  discarded because the count beside it is missing. A 204 answers `[]` and resets `totalCount`,
  `hasNextPage` and `currentViewCount`, which were left describing the previous query.

### Added

- **`AnzuApiCancelledError`, with `isAnzuApiCancelledError`.** A stopped request is not a failed one
  — it is another keystroke in an autocomplete, or a route change mid-load — and it used to arrive
  as `AnzuApiAxiosError`, indistinguishable from a dead backend. The check meant to catch it tested
  for a `DOMException` that axios does not throw, so it never fired.

  **Add one line to your global error handling:** `if (isAnzuApiCancelledError(e)) return`.

- **Cancellation you can actually use.** `abort()` stops everything an instance has in flight, for
  `onScopeDispose(abort)`. `cancelPrevious: true` makes each call supersede the one before it,
  aborting before the new call registers so the newest always wins. A per-call `signal` composes with
  a controller you already own. A list write is guarded by a generation, because aborting a request
  does not stop a response already on its way.

- **`setApiErrorLogger(fn | null)`** replaces `silentConsoleError`, which was per instance — so
  whether a failure was written down depended on which call made it. The default still writes to the
  console. Reporting happens after mapping, on the final class, so the errors a helper raises about
  its own contract reach it too; cancellations and the mapped domain classes never do.

  Worth doing at the same time: `setApiErrorLogger((e, ctx) => Sentry.captureException(e, { extra: ctx }))`.
  Sentry has no console integration in these apps, so failures that are caught and swallowed are
  currently visible nowhere.

- **`AnzuError`**, which all ten error classes now extend, and `isAnzuError`. The helpers use it to
  tell an already-mapped error from a raw one without matching on the name.
