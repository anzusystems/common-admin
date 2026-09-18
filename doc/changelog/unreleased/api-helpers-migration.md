planned
===

### Deprecated

- **The old `src/services/api/` helpers now fail an import, not just a doc block.** `apiFetchOne`,
  `apiCreateOne`, `apiUpdateOne`, `apiDeleteOne`, `apiFetchByIds`, `apiAnyRequest`, `apiFetchList`,
  `apiFetchListBatch` and `apiGenerateListQuery` are on the `anzu/no-deprecated-imports` consumer
  list, alongside the list wrappers that call them — `fetchDamUserList`, `fetchDamExtSystemList`,
  `fetchDamAssetLicenceList`, `fetchDamAssetLicenceGroupList` — and `usePaginationAutoHide`.

  Replace them with the labs helpers: `useApiRequest`, `useApiFetchByIds`, `useApiFetchList`,
  `useApiFetchListBatch`. What changes when you do, none of which the compiler will point at:

  - a 204 answers `undefined` where the old one answered `null`, and a by-ids 204 answers `[]`
  - a 202 with no body **resolves** instead of rejecting as a fatal error
  - failures arrive as `AnzuApiAxiosError`, `AnzuApiTimeoutError` or `AnzuApiResponseCodeError`, not
    always `AnzuFatalError`. Inside this repo nothing changes for the user: `showErrorsDefault`
    tests `isAnzuApiAxiosError` before `isAnzuFatalError` and both answer with the same unknown-error
    alert, and a timeout now gets its own message instead of that one. Code outside it that branches
    on `isAnzuFatalError` does need revisiting -- no admin in the fleet does
  - an axios failure reaches the console unless you pass `silentConsoleError`
  - the type parameters swap sides: `apiCreateOne<Body, Response>` against
    `useApiRequest<Response, Body>`, and each defaults to the other, so the wrong order compiles
  - a call that passed `{}` as its body must keep passing it; the labs helper omits an undefined body

- **`usePaginationAutoHide` has no labs replacement.** Until it does, inline the predicate — see the
  three-line computed in admin-blog's `NoteDatatable.vue`.

- **`apiFetchListBatch` is not a like-for-like port.** It answers a different set of items from
  `useApiFetchListBatch`: its loop counts pages from 0 into a 1-based offset, so it asks for a
  negative offset first, re-fetches page one, and never requests the last page.

### Changed

- **`DamUserFilterRemoteAutocompleteLegacy`, `DamKeywordFilterRemoteAutocompleteLegacy` and
  `DamAuthorFilterRemoteAutocompleteLegacy` run on the labs api.** They keep their legacy `Filter`
  prop and their legacy host, so nothing changes for a caller; only the api layer underneath moved.
