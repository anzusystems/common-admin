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
  - **`optionalBody: true`** is for an endpoint documented to answer either way; it resolves
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

  `showErrorsDefault` already knows about it and answers `true` — handled, nothing to show — so the
  callers written as `if (!showErrorsDefault(e)) showUnknownError()` no longer toast on a request the
  user superseded by typing another character.

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

- **`loading` on every helper.** `const { execute, abort, loading } = useApiFetchList(...)`. It is
  `true` while the instance has anything in flight, and the instance owns it for a reason: the ref you
  clear in a `finally` belongs to whichever call ended, including one that `cancelPrevious` has just
  superseded — so the spinner goes out while the call the user is waiting for is still running. Two
  things to know before swapping yours out for it. It covers the request and nothing after it, so a
  `listLoading` that also spans a follow-up cached fetch is not a one-for-one replacement. And it is
  reachable only if you hold the instance: a factory that builds one per call and hands back only the
  promise — the shape `useJobApi` and the `useAnzuUserApi` factories use — cannot expose `loading`,
  `abort` or `cancelPrevious` at all. Hoist the instance to where the caller lives, or keep your own
  flag.

- **`useApiFetchItems<T>`**, for a list whose query the call site wrote: a fixed order, a limit, a
  filter that is not the user's to change. Ten places in the fleet were doing this through
  `useApiRequest<ApiResponseList<T[]>>` and reading `.data` off the envelope, which means nothing
  checked that `data` was an array. It takes the url with the query already in it, answers `T[]`, and
  writes no pagination. `urlParams` substitute into the path only — a `:name` inside the query is
  sent as written.

- **`status` on the error context.** `setApiErrorLogger((e, ctx) => …)` now receives the status the
  backend answered with, when it answered, so an application can filter what it considers expected —
  a 404 that a caller probes for, for instance — without the per-call switch that `silentConsoleError`
  used to be. Two statuses are not yours to filter because the library already drops them: **401 and
  403**. Neither is an endpoint failing its contract; they are the session, every admin branches on
  them already, and a 401 is what every unauthenticated start of the app answers with.
