# Posudok Opus: core-cms štatistiky – zhoda so vzormi projektu (b6d4d66ef)

Zadanie `krok5-praca/zadania/posudok-cms-vzory-prompt.md`, agent `posudok-cms-vzory`, 25. 10. 2026. Skrátené.

**Verdict: partly fits.** Follows: domain layout, adm controller, role check (precedent common-bundle `LogController.php:45`),
domain exception + handler + `Retry-After`, existing `anzu_collaboration` client and guard, repository query style,
mock client and services_test wiring, test base class and fixtures, changelog body.

**Must change to fit the project**
1. Query input: `#[SerializeParam]` DTOs (`Domain/CollabStats/Model/DataObject`) with `Assert\*`, `ArrayStringHandler`,
   one `Assert\Callback`, `toQueryParams()` (precedent `MetricApiRequest::toQueryParams()`), route `requirements` on
   `{id}`, `Validator::validate()` → 422 `validation_failed` with `fields` (contract change for admin-cms). Examples:
   `DeskController.php:209,223`, `DeskFacade.php:116`, `ImageListUsageFilterDto.php:22-27`. `Uuid::isValid()` instead of a
   regex.
2. Article version: the project picks the revision of a docId by `ArticleStatus::FLOW_PRIORITY`
   (`ArticleKindStandardRepository.php:848-852`, `ArticleStatus.php:21-30`); the new code takes the highest version, and
   two tests pin opposite answers (`ArticleKindStandardRepositoryTest.php:123` vs `CollabStatsControllerTest.php:303`).
3. Failure logs through `CmsLogger` (journal) instead of the app channel (where `info` is dropped in prod); the limiter
   wired like the other two (named `storage_service`, `config/services/rate_limiter.php:20-38`).
4. `users` map: drop it with `findFullNamesByIds` and the key walker; admin-cms shows names with `ACachedUserChip` /
   `useCachedUsers` (90 files), Anzu serializes users as ids (`UserTrackingTrait.php:23`). Contract change.

**Smaller deviations:** `max_duration` (elsewhere a `timeout` const or config), no `X-Context-ID`/`X-App-Version` on the
raw request (`MailerClient.php:400,414`), 503 for a failed downstream (project 502: `MailerClientExceptionHandler.php:25`),
404 re-implements `NotFoundExceptionHandler`, generic `CollabStatsUrl::get` (others one method per endpoint).

**Acceptable as is (owner to confirm):** body passthrough with `new JsonResponse` and `OAResponseCollabStats` — the shapes
belong to collaboration, mirroring six DTO trees adds code. (Codex `cms-vzory-codex.md` asks for `okResponse` and
endpoint-specific OpenAPI models.)
