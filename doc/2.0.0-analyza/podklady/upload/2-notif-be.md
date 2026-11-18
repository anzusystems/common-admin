# notification-server retirement: backend and service side

Read-only analysis, 2026-10-07. Nothing was executed (no builds, tests, containers, php). Every statement in sections 1-8 is read from the cited line unless it carries the word **inferred**. Proposals are only in section 10.

## 0. Sources, versions, path legend

| Short | Path | Version |
|---|---|---|
| `NS/` | `/home/volar/projects/anzusystems/notification-server/` | `1.2.1` (`NS/package.json:4`), HEAD `fc0369f` |
| `APP/` | `/home/volar/projects/petit/core-dam/` | HEAD `890bdfa` "changelog: release 1.65.0", working tree clean |
| `B/` | `/home/volar/projects/petit/core-dam/vendor/anzusystems/core-dam-bundle/src/` | **1.52.0** (`APP/composer.lock:305-306`, same in `APP/vendor/composer/installed.json:311-312`; constraint `^1.52.0` at `APP/composer.json:13`; vendor files dated 2026-09-01) |
| `GPS/` | `/home/volar/projects/petit/core-dam/vendor/petitpress/gps-messenger-bundle/src/` | 4.0.0 (`APP/vendor/composer/installed.json:4288-4289`) |

Whether 1.52.0 is the newest bundle release upstream could not be checked offline. The lock in git HEAD and the installed vendor copy agree.

Route prefix: the bundle's adm controllers are mounted under `/api/adm/v1/` (`APP/config/routes/dam.php:11-13`), so the endpoint named in the brief is `GET /api/adm/v1/asset/{id}`.

---

## 1. The service (notification-server)

1. A plain Node `ws` server plus one Google Pub/Sub subscriber, started together (`NS/src/index.ts:28-33`). No database, no HTTP API, no persistence.
2. **Browser auth**: on the HTTP `upgrade` it reads the JWT from cookies and verifies the signature with a public key (`NS/src/server/websocket-server.ts:40-51`, `NS/src/util/user-token-verifier.ts:8-23`). The token is assembled by joining several cookies with `.` (`user-token-verifier.ts:10-12`); dev config uses `anz_jp,anz_js`, ES256 (`NS/.env.dist:14-15`). A bad token gets `401` and the socket is destroyed (`websocket-server.ts:44-50`).
3. The dev public key in `NS/.env.dist:16` is the same string as DAM's `AUTH_JWT_PUBLIC_CERT` (`APP/.env:142`): it validates the cookie the DAM backend itself issues. The browser needs no extra login.
4. **Origin check**: `verifyClient` tests the `Origin` header against the regex `WEBSOCKET_SERVER_CORS` (`websocket-server.ts:26-32`, `NS/.env.dist:12`). Path is `/ws` (`websocket-server.ts:24`).
5. **Socket to user**: `ssoUserId = token.sub` is stored on the socket (`websocket-server.ts:43,55`) and the socket is added to an in-memory `Map<userId, Set<socket>>` (`NS/src/model/user-connections.ts:6-15`). Several tabs of one user = several sockets, all receive.
6. **Heartbeat**: ping every 3 s; a socket that did not pong since the last tick is terminated (`websocket-server.ts:67-85`).
7. **Topic**: one topic, name from `PUBSUB_TOPIC` (`NS/src/pubsub/notification-pub-sub.ts:8`), dev value `notification_server_internal` (`NS/.env.dist:7`); created if missing (`notification-pub-sub.ts:65-84`).
8. **Scaling**: each instance creates its own subscription `<topic>_<APP_INSTANCE_NAME>` (`notification-pub-sub.ts:91-103`), so every instance receives every message and delivers only to sockets it holds. Subscription expires after 24 h without activity (`:101`).
9. **Message format in** (Pub/Sub): `attributes.eventName` (string), `attributes.targetSsoUserIds` (JSON array as a string), `data` (any string) (`NS/README.md:18-21`, `notification-pub-sub.ts:29-43`).
10. **Message format out** (WebSocket frame): `JSON.stringify({eventName, data})` where `data` is the Pub/Sub payload **as a string** (`notification-pub-sub.ts:47-54`). The backend puts serialized JSON into it, so the browser parses twice.
11. **No replay**: for each target user it loops over the sockets currently connected to this instance and sends; if there are none the loop body does not run, and the message is acked regardless (`notification-pub-sub.ts:45-58`). A message published while the browser is disconnected or reconnecting is lost.
12. **No per-topic subscription from the browser**: the `connection` handler registers only `pong` and `close` (`websocket-server.ts:61-65`); there is no `ws.on('message')`. Routing is solely by user id.
13. **No authorization of content**: it forwards whatever was published to whichever user ids the publisher named. No licence/asset ACL is involved.
14. `enableMessageOrdering: true` is set on the subscription (`notification-pub-sub.ts:102`), but the DAM publisher sets no ordering key (`B/Notification/AbstractNotificationDispatcher.php:74-82`). **Inferred**: order between events is therefore not guaranteed by Pub/Sub.
15. The id the server matches (`token.sub`) must equal the id DAM publishes (`(int) $user->getId()`). DAM takes user ids from SSO (`APP/src/Domain/User/UserFacade.php:94-108`).

---

## 2. Every event the backend dispatches

### 2.1 Publisher

One method does all publishing: `AbstractNotificationDispatcher::notify(array $userIds, string $eventName, ?object $data, ?string $extSystemSlug)` (`B/Notification/AbstractNotificationDispatcher.php:55-83`).

- returns immediately when notifications are disabled (`:57-60`);
- returns when the ext system has `notifications_enabled: false` (`:62-67`), only for events that pass a slug;
- otherwise constructs a **new** `PubSubClient` on every call (`:69-72`) and publishes synchronously, REST transport (`APP/config/packages/settings.php:59-63`), attributes `targetSsoUserIds = json_encode($userIds)`, `eventName`, `data = serialized DTO or ''` (`:74-82`).
- No `try/catch` here or in any of the seven subscribers (`B/Event/Subscriber/AssetFileEventSubscriber.php:34-41`, `MetadataProcessedSubscriber.php:29-32`, `AssetFileEventCopiedSubscriberSubscriber.php:29-32`, `AssetDeleteEventSubscriber.php:29-32`, `AssetFileDeleteEventSubscriber.php:34-47`, `DistributionStatusEventSubscriber.php:29-32`, `DistributionAuthorizedSubscriber.php:29-32`). See 8.1 for what that implies.

### 2.2 Event table

Every event goes to **exactly one user id**. There is no fan-out to "everybody with the licence".

| Event name | Dispatch site | When | Payload (`data`) | Target user |
|---|---|---|---|---|
| `asset_file_uploaded` | `B/Domain/AssetFile/AbstractAssetFileStatusFacade.php:196` (also `B/Domain/PodcastEpisode/EpisodeRssImportManager.php:365`) | inside the `PATCH .../uploaded` request, after status is flushed | A | file `notifyTo` |
| `asset_file_stored` | `AbstractAssetFileStatusFacade.php:289` | worker, after the storage write is committed | A | file `notifyTo` |
| `asset_file_processed` | `AbstractAssetFileStatusFacade.php:318` | worker, after processing is committed | A | file `notifyTo` |
| `asset_file_duplicate` | `AbstractAssetFileStatusFacade.php:236` | worker, same checksum already processed in the licence | A, `originAssetFile` = id of the existing **file** | file `notifyTo` |
| `asset_file_failed` | `AbstractAssetFileStatusFacade.php:244` and `:252` | worker, processing threw | A, `failReason` set | file `notifyTo` |
| `asset_metadata_processed` | `B/Domain/AssetFile/FileProcessor/MetadataProcessor.php:43` | worker, after exif + suggestions + autocomplete (two call paths, see 3) | A (status = whatever it is at that instant) | file `notifyTo` |
| `asset_file_copied` | `B/Domain/Image/ImageCopyFacade.php:122-124` | worker, after the copy transaction commits; once per slot file of the copy | A, `originAssetFile` = id of the **source file** | copy file `notifyTo` |
| `asset_file_deleted` | `B/Domain/AssetFile/AbstractAssetFileFacade.php:321-327` (single file); `B/Domain/Asset/AssetFacade.php:149` (with its asset); also `B/Domain/AssetLicence/AssetLicenceRetentionFacade.php:95`, `B/Domain/Job/Processor/JobUserDataDeleteProcessor.php:87` | after the delete is committed | `{asset, id}` only | see 2.3 |
| `asset_deleted` | `AssetFacade.php:150` (also `AssetLicenceRetentionFacade.php:96`, `JobUserDataDeleteProcessor.php:88`) | worker, after the delete is committed | `{asset}` | see 2.3 |
| `distribution_distributing`, `distribution_remote_processing`, `distribution_distributed`, `distribution_failed` | `B/Domain/Distribution/DistributionStatusFacade.php:59` | after each status change is committed | `{id, asset, assetFile, status}` (no `failReason`) | distribution `notifyTo` |
| `distribution_authorized` | `B/Distribution/Modules/Youtube/YoutubeAuthenticator.php:89-94` | in the Youtube OAuth callback request | `{distributionService, success}` | the user who started the OAuth flow (`getInitiatorId()`, `:92`) |
| `user_updated` | `APP/src/Notification/UserNotificationDispatcher.php:17-20`, called from `APP/src/Domain/User/UserFacade.php:60,73,86` and `DeprecatedUserFacade.php:39,69,82` | after a user is updated | none (`''`) | the updated user |

Payload **A** = `AssetFileStatusAdmNotificationDecorator`: `asset` (asset id), `id` (file id), `status`, `failReason`, `assetType`, `originAssetFile` (`B/Model/Domain/AssetFile/AsseFileAdmNotificationDecorator.php:11-15`, `AssetFileStatusAdmNotificationDecorator.php:37-59`). Other payloads: `AssetAdmNotificationDecorator.php:11-12`, `B/Model/Domain/Distribution/DistributionAdmNotificationDecorator.php:13-23`, `DistributionAuthorizedAdmNotificationDecorator.php:12-16`.

Event names are built as prefix + status string: `'asset_file_' . status` (`B/Notification/AssetFileNotificationDispatcher.php:20,53`) and `'distribution_' . status` (`B/Notification/DistributionNotificationDispatcher.php:17,31`).

Names that can never occur: `asset_file_uploading` (no dispatch while the status is `uploading`; the six call sites above are all of `dispatchAssetFileChanged`) and `distribution_waiting` (the facade has no transition to `waiting`, `DistributionStatusFacade.php:25-43`).

`DistributionAuthorized` is constructed in one place only and never with `success: false` (`YoutubeAuthenticator.php:90-93`, default `true` at `B/Event/DistributionAuthorized.php:12`).

### 2.3 How the target user is chosen

- **`notifyTo`** is a nullable `ManyToOne` to the user on `Asset`, `AssetFile` and `Distribution` (`B/Entity/Traits/NotifyToTrait.php:12-13`).
- It is overwritten with the **current user on every tracked create or modify that happens inside an HTTP request** (`B/Domain/AbstractManager.php:76-88`, `:90-102`, `:104-111`; the condition is `$this->requestStack->getCurrentRequest()` at `:106`).
- So it is "the last user who touched this entity through the API", not strictly the uploader. Example: `ImageFacade::update` calls `imageManager->updateExisting($image)` with tracking on (`B/Domain/Image/ImageFacade.php:96-103`); a second user saving the image while it is still processing takes over its events.
- In a messenger worker there is no request, so `notifyTo` is left alone (`AbstractManager.php:106`).
- For an upload: set at create (`B/Domain/AssetFile/AssetFileManager.php:88-95`) and again at finish, because `toUploaded` tracks modification (`B/Domain/AssetFile/AssetFileStatusManager.php:33-40`, `:102-115`). Both are the uploader.
- If `notifyTo` is null the event is silently skipped (`AssetFileNotificationDispatcher.php:47-49`, `:64-66`, `:80-82`; `DistributionNotificationDispatcher.php:25-27`).
- **`asset_deleted`** and the file deletes that go with it: `$asset->getNotifyTo() ?: $asset->getCreatedBy()` (`AssetFacade.php:312`, used at `:316`, `:326`, `:331-339`). Because `DELETE /asset/{asset}` first runs `toDeleting`, which tracks modification (`B/Domain/Asset/AssetStatusManager.php:16-22`, `B/Domain/Asset/AssetManager.php:43-52`), this is normally the user who pressed delete.
- **`asset_file_deleted` for a single file delete**: `$assetFile->getModifiedBy()` (`AbstractAssetFileFacade.php:326`). This is the file's last modifier, **not necessarily the user who deleted it**; the delete itself does not track modification (`AssetFileManager.php:102-119`).

### 2.4 Configuration and switches

| Switch | Where | Default | Value in the app |
|---|---|---|---|
| `anzu_systems_core_dam.settings.notifications.enabled` | `canBeDisabled()` node, `B/DependencyInjection/Configuration.php:183-194`; read by `B/Model/Configuration/NotificationsConfiguration.php:24,35-38` | `true` | not set, so enabled (`APP/config/packages/settings.php:59-63`); `false` only in the test env (`APP/config/packages/test/anzu_systems_core_dam.php:15-17`) |
| topic | env `MESSENGER_NOTIFICATION_TOPIC`, injected by `B/DependencyInjection/AnzuSystemsCoreDamExtension.php:511-516` | - | `notification_server_internal` (`APP/.env:131`) |
| credentials | `GOOGLE_PUBSUB_SA_KEY` (`AnzuSystemsCoreDamExtension.php:518`) | - | - |
| `ext_systems.<slug>.notifications_enabled` | `Configuration.php:346-348`, `B/Model/Configuration/ExtSystemConfiguration.php:16,51,94-97` | `true` | set nowhere in `APP/config` (grep: no match) |

`MESSENGER_NOTIFICATION_TOPIC` is absent from `APP/docker/kubernetes/configuration.yaml` (the only notification entries there are `ANZU_NOTIFICATION_DOMAIN` at `:21` and the token at `:217`, both for the other service, see 9). **Inferred**: production takes the topic name from the committed `APP/.env:131`.

The per-ext-system flag is visible to the frontend: `GET /api/adm/v1/configuration/ext-system/{extSystem}` returns `notificationsEnabled` (`B/Controller/Api/Adm/V1/ConfigurationController.php:47-57`, `B/Model/Decorator/ExtSystemAdmGetDecorator.php:41-45`). The **global** flag is not exposed: `SettingsConfigurationAdmGetDecorator` serializes eight settings and none is about notifications (`B/Model/Decorator/SettingsConfigurationAdmGetDecorator.php:32-75`).

### 2.5 If it is switched off, what else depends on it

With `settings.notifications.enabled: false`:

- `notify()` returns at `AbstractNotificationDispatcher.php:58-60`. Nothing is published.
- The DI extension skips one block (`AnzuSystemsCoreDamExtension.php:510-556`): the topic/credentials for notifications, the cache pool `core_dam_bundle.pub_sub_token_cache` (`:526-530`) and a messenger transport named after the topic (`:535-552`).
- That messenger transport has no message routed to it (routing table `:428-440`) and no consumer (`APP/docker/bin/messenger-supervisor-conf:4-19` does not list it). **Inferred**: it exists only so the topic is declared; nothing consumes from it in DAM.
- The Symfony domain events are still dispatched and their other effects still run:
  - on `duplicate`, queueing of the asset property refresh (`AssetFileEventSubscriber.php:38-40`);
  - on file delete, crop cache purge (`AssetFileDeleteEventSubscriber.php:36-44`);
  - the app's own listeners on the same events: `APP/src/Event/Listener/AudioFileProcessedListener.php:16`, `MediaApiChangeStateEventListener.php:18`, `DistributionStatusEventListener.php:18`, `AssetFileDeleteListener.php:15`.
- `notifyTo` keeps being written; its only other reader is the delete target at `AssetFacade.php:312`.
- A disabled setup is a supported configuration: the test environment runs that way (`APP/config/packages/test/anzu_systems_core_dam.php:15-17`). **Inferred** (not executed): the `#[Required]` setter for the token cache (`AbstractNotificationDispatcher.php:44-48`) still autowires when the dedicated pool is not declared.

Nothing in the upload, copy, delete or distribution logic reads the notification result. The dependency runs the other way (8.1).

---

## 3. Upload pipeline as a timeline (image)

File statuses: `uploading`, `uploaded`, `stored`, `duplicate`, `processed`, `failed` (`B/Model/Enum/AssetFileProcessStatus.php:12-17`). Allowed transitions: `uploading -> uploaded|failed`; `uploaded -> stored|duplicate|failed`; `stored -> processed|duplicate|failed`; `duplicate|processed -> failed`; `failed` is final (`AssetFileStatusManager.php:123-130`).

`GET asset` below means `GET /api/adm/v1/asset/{id}` (`AssetAdmDetailDto`). Field paths are the serialized ones.

| # | Where | What happens | File status after | Event | What changes on `GET asset` |
|---|---|---|---|---|---|
| 0 | HTTP `POST /api/adm/v1/image/licence/{licence}` (`B/Controller/Api/Adm/V1/ImageController.php:96-106`) | file, asset, slot created in one transaction and indexed (`AbstractAssetFileFacade.php:218-240`). The first file of an asset becomes its main file (`B/Domain/AssetSlot/AssetSlotFactory.php:29,36-39`). | `uploading` (default, `B/Entity/Embeds/AssetFileAttributes.php:63`) | none | asset exists: `attributes.assetStatus = draft`, `mainFile.id`, `mainFile.fileAttributes.status = uploading`, `failReason = none`, `size`/`mimeType` as sent (`B/Domain/Image/ImageFactory.php:27-30`), `mainFile.originAssetFile = ''` |
| 1 | HTTP `POST /api/adm/v1/image/{image}/chunk`, N times (`ImageController.php:187-198`) | chunk stored, uploaded size counted (`B/Domain/Chunk/ChunkFacade.php:48-55`). First chunk only: `originFileName` set (`B/Domain/Chunk/FirstChunkProcessor.php:14-15`) and, after commit, `AssetFileMetadataProcessMessage` queued (`ChunkFacade.php:57-59`). | `uploading` | none | `mainFile.fileAttributes.originFileName` |
| 1b | worker, queue `anzu_core_dam_asset_file_metadata_process` (`AnzuSystemsCoreDamExtension.php:434`) | **metadata processing off the first chunk**, in parallel with the remaining chunks (`B/Messenger/Handler/AssetFileMetadataProcessHandler.php:33-49`): exiftool on the first chunk (`B/Domain/AssetMetadata/AssetMetadataProcessor.php:42-51`), `flags.processedMetadata = true` (`:52`), author/keyword suggesters (`:54`), custom-data autocomplete when the asset is neither described nor autocompleted yet (`MetadataProcessor.php:35-37`), flush (`:39-42`). Returns without doing anything if the chunk row is already gone (`AssetFileMetadataProcessHandler.php:38-40`). | unchanged | `asset_metadata_processed` (`MetadataProcessor.php:43`) | `mainFile.metadata.exifData`; `metadata.customData`; `metadata.authorSuggestions`; `metadata.keywordSuggestions`; possibly `authors`, `keywords`. No flag, no status, no `modifiedAt` (tracking is off, `MetadataProcessor.php:39-42`). See 4a. |
| 2 | HTTP `PATCH /api/adm/v1/image/{image}/uploaded` with `{checksum}` (`ImageController.php:219-232`) | checks all bytes arrived (`AbstractAssetFileStatusFacade.php:338-347`), stores checksum, `toUploaded` (`:193-194`), queues `ImageFileChangeStateMessage` (`:197`, `B/Domain/AssetFile/AssetFileMessageDispatcher.php:22-32`). The response body already carries `status: uploaded`. | `uploaded` | `asset_file_uploaded` (`:196`), sent from inside this request | `mainFile.fileAttributes.status = uploaded` |
| 3a | worker, queue `anzu_core_dam_image_file_change_state` (`B/Messenger/Handler/AssetFileChangeStateHandler.php:79-117`, `:89`) | file assembled from chunks (`AbstractAssetFileStatusFacade.php:211`, `:355-365`); mime re-detected and checked, size set (`B/Domain/AssetFile/FileProcessor/FileAttributesProcessor.php:63-91`); checksum compared (`:34-57`); lock per `type_licenceId` (`AbstractAssetFileStatusFacade.php:207,215`); duplicate check (`:270`) | | | |
| 3a-dup | same | same checksum already `processed` in the same licence, other asset (`B/Domain/Image/ImageStatusFacade.php:63-69`): `originAssetId` set to the existing file's id (`AbstractAssetFileStatusFacade.php:228-230`), `toDuplicate` (`:235`) | `duplicate` (terminal) | `asset_file_duplicate` (`:236`) | `status = duplicate`, `mainFile.originAssetFile = <existing file id>`; asset stays `draft` |
| 3a-ok | same | written to storage, `toStored`, commit (`:279-282`) | `stored` | `asset_file_stored` (`:289`) | `status = stored`, corrected `mimeType`/`size` |
| 3b | same handler invocation, continues (`:221-225`) | chunks deleted (`:222`); one transaction (`:302-309`): image processing = animated flag, optimal resizes, default ROI (`ImageStatusFacade.php:45-61`); metadata processing **only if** `flags.processedMetadata` is still false (`:305-307`); `toProcessed`, which also moves the asset `draft -> with_file` (`AssetFileStatusManager.php:65-76`); commit; `AssetRefreshPropertiesMessage` queued (`:310-312`) | `processed` (terminal) | optionally `asset_metadata_processed` (from `:306`, **before** the commit at `:309`), then `asset_file_processed` (`:318`, after commit) | `status = processed`, `attributes.assetStatus = with_file`, `mainFile.imageAttributes`, links |
| 3c | same | `AssetFileProcessFailed` -> `toFailed(reason)` (`:237-243`); any other `Throwable` -> `toFailed(unknown)` (`:245-251`) | `failed` (terminal) | `asset_file_failed` (`:244` / `:252`) | `status = failed`, `fileAttributes.failReason` |
| 4 | worker, queue `anzu_core_dam_property_refresh` (`B/Messenger/Handler/RefreshAssetPropertiesHandler.php:33-58`) | display title, main file, slot flags, asset status, slot names, width/height recomputed and reindexed (`B/Domain/Asset/AssetPropertiesRefresher.php:34-44`) | unchanged | **none** | `texts.displayTitle`, `assetFileProperties.width/height/slotNames` |

Fail reasons that exist: `none`, `unknown`, `invalid_checksum`, `invalid_mime_type`, `download_failed`, `invalid_size` (`B/Model/Enum/AssetFileFailedType.php:12-17`). For a chunk upload the reachable ones are `invalid_mime_type` (`FileAttributesProcessor.php:83`), `invalid_checksum` (`:50`) and `unknown` (`AbstractAssetFileStatusFacade.php:249`).

Notes on `asset_metadata_processed`:

- There are exactly two callers of `MetadataProcessor::process`: the first-chunk handler (`AssetFileMetadataProcessHandler.php:47`) and `process()` (`AbstractAssetFileStatusFacade.php:306`). They run on different queues in different processes.
- Depending on which wins, a normal upload yields the event once from 1b (typical for a multi-chunk file), once from 3b (when 1b found the chunk already deleted or had not run yet), or from both. **Inferred**: the count is "one or two", never guaranteed to be exactly one.
- For a duplicate or an early failure the chunks are not cleared (clearing is only in the `stored` branch, `:222`), so 1b still runs and still sends `asset_metadata_processed` for a file that ends `duplicate`/`failed`. **Inferred** from the same lines: its order relative to `asset_file_duplicate` is not fixed.
- In path 3b the event is published while the surrounding transaction is still open (`:302` begin, `:306` metadata, `:309` commit). **Inferred**: a client that reacts to the push by reading the asset can read the state from before the commit.

After `processed` there is still step 4, which has no event. This gap exists for push clients today as well.

---

## 4. Can a polling client learn everything the events convey?

Short answer: **yes for every event except `asset_metadata_processed`**, which has no readable equivalent before the file reaches `processed`.

### 4a. "Metadata processed": no readable flag

- The flag exists in the database: `AssetFile.flags.processedMetadata` (`B/Entity/Embeds/AssetFileFlags.php:13-14`, default false `:30`), set at `AssetMetadataProcessor.php:52`.
- It is **not serialized**. `AssetFileFlagsAdmDto` exposes `public`, `singleUse`, `internal`, `overrideInternal` only (`B/Model/Dto/AssetFile/Embeds/AssetFileFlagsAdmDto.php:12-22,24-32`). Its only reader in the whole bundle is `AbstractAssetFileStatusFacade.php:305`.
- The asset-side flag `assetFlags.autocompletedMetadata` (`B/Entity/Embeds/AssetFlags.php:22-23`, set at `B/Domain/AssetMetadata/AssetMetadataAutocomplete.php:48`) is not serialized either: `AssetFlagsAdmDto` exposes `described`, `visible`, `ttsAudio` (`B/Model/Dto/Asset/Embeds/AssetFlagsAdmDto.php:12-19`).
- What a poll can see instead, all of it indirect:
  - `mainFile.metadata.exifData` (image only, `B/Model/Dto/Image/ImageFileAdmDetailDto.php:20-21`, `B/Model/Dto/AssetFileMetadata/AssetFileMetadataAdmDetailDto.php:19-20`). It is the filtered tag map (`B/Domain/AssetMetadata/ExifMetadataFilter.php:22-32`), so an image with none of the configured tags gives `[]`, identical to "not processed yet".
  - `metadata.customData`, `metadata.authorSuggestions`, `metadata.keywordSuggestions` (`B/Model/Dto/AssetMetadata/AssetMetadataAdmDetailDto.php:12-19`), `authors`, `keywords` (`B/Model/Dto/Asset/AssetAdmDetailDto.php:30-37`). Same problem: empty before and possibly empty after.
  - Audio, video and document detail DTOs do not expose the file `metadata` at all (`B/Model/Dto/Audio/AudioFileAdmDetailDto.php:12-50`, `B/Model/Dto/Video/VideoFileAdmDetailDto.php:11-42`, `B/Model/Dto/Document/DocumentFileAdmDetailDto.php:11-32`).
- One guarantee does hold: `status = processed` implies metadata processing has run, because `process()` runs it if the flag is false before it calls `toProcessed` (`AbstractAssetFileStatusFacade.php:305-308`).
- So without a backend change a poller knows "metadata is processed" for certain only at `processed`. It cannot detect the earlier moment (step 1b, while chunks are still uploading) that the push gives today.

### 4b. Duplicate: readable

`mainFile.originAssetFile` is on every file detail DTO: image (`ImageFileAdmDetailDto.php:88-92`), audio (`AudioFileAdmDetailDto.php:36-40`), video (`VideoFileAdmDetailDto.php:37-41`), document (`DocumentFileAdmDetailDto.php:18-22`), and the asset detail embeds the main file in detail view (`AssetAdmDetailDto.php:147-151`). It is the same value the event carries (`AssetFileStatusAdmNotificationDecorator.php:55-59`).

It is a **file** id despite the entity name `originAssetId` (`AbstractAssetFileStatusFacade.php:228-230`, where `getOldAsset()` returns the `AssetFile`). To get the original asset from it: `GET /api/adm/v1/asset/asset-file/{assetFile}` (`B/Controller/Api/Adm/V1/AssetController.php:180-187`).

Caution: `originAssetFile` is also non-empty on a **copy** whose status is `processed` (4d). Non-empty does not mean duplicate; `status = duplicate` does.

### 4c. Failed: readable

`mainFile.fileAttributes.status = failed` and `mainFile.fileAttributes.failReason` (`B/Model/Dto/AssetFile/Embeds/AssetFileAttributesAdmDto.php:16-20`, filled at `:45,50`). Same value as in the event (`AssetFileStatusAdmNotificationDecorator.php:43-47`).

### 4d. Copy of an image to another licence (`asset_file_copied`)

Exact sequence:

1. `PATCH /api/adm/v1/image/copy-to-licence`, up to 20 items (`ImageController.php:300-313`, `ImageCopyFacade.php:39,212-217`). For each item `prepareCopy` looks for a `processed` file with the same checksum in the target licence (`ImageCopyFacade.php:131-142`) and answers one of:
   - `copy`: a draft copy asset is built now (`:146-156`);
   - `exists`: an identical asset is already there; its ids are returned and **nothing further happens, no event** (`:167-173`);
   - `notAllowed`: conflicting assets are listed, no event (`:158-165`).
   The response gives `asset`, `targetAsset`, `targetMainFile`, `targetAssetLicence`, `result`, `assetConflicts` (`B/Model/Dto/Image/AssetFileCopyResultDto.php:18-34`).
2. For `copy`, still inside the request and committed before the response (`ImageCopyFacade.php:69-79`), `AssetCopyBuilder::buildDraftAssetCopy` (`B/Domain/Asset/AssetCopyBuilder.php:25-47`):
   - `Asset::__copy()` clones attributes, texts, asset flags, file properties, **metadata** (`customData`, `keywordSuggestions`, `authorSuggestions`), authors, keywords, distribution category (`B/Entity/Asset.php:134-149`, `B/Entity/AssetMetadata.php:45-52`);
   - asset status forced to `draft` (`AssetCopyBuilder.php:28`);
   - one **blank** file per source slot (`:58-67`, `B/Domain/AssetFile/AbstractAssetFileFactory.php:108-118`, `:226-239`): status `uploading`, empty attributes, empty `exifData`; its `notifyTo` becomes the requesting user (`AssetFileManager.php:88-95`);
   - main file set (`AssetCopyBuilder.php:36-42`).
3. After commit one `CopyAssetFileMessage` per `copy` result is queued (`ImageCopyFacade.php:88-95`), queue `anzu_core_dam_asset_copy` (`AnzuSystemsCoreDamExtension.php:439`, `APP/.env:133`).
4. Worker (`B/Messenger/Handler/CopyAssetFileMessageHandler.php:32-44`) runs `copyAssetFiles` in **one transaction** (`ImageCopyFacade.php:106-113`). For each slot, `AssetFileCopyBuilder::copy` (`B/Domain/AssetFile/AssetFileCopyBuilder.php:25-44`):
   - replaces the copy's attributes with a **clone of the source file's attributes** (`:27`), so the status jumps straight from `uploading` to whatever the source has, normally `processed`;
   - sets `originAssetId` to the source file id (`:28`);
   - copies `singleUse` (`:29`), the stored binary (`:30`), image attributes, ROIs and resizes (`B/Domain/Image/ImageFileCopyBuilder.php:23-28`).
   Then asset properties are refreshed, which moves the asset to `with_file` when a slot file is `processed` (`ImageCopyFacade.php:108`, `AssetPropertiesRefresher.php:127-142`), and the asset is reindexed (`:112`).
5. After the commit, `asset_file_copied` is dispatched once per slot file (`ImageCopyFacade.php:122-124`).

Answers to the specific questions:

- **Which statuses does the copy pass through?** Only two observable states: `uploading` (from the PATCH response until the worker commits) and then the source's status, normally `processed`. It never passes `uploaded` or `stored`. No `asset_file_*` status event is emitted for it, because the status manager is bypassed (`AssetFileCopyBuilder.php:27`).
- A copy slot that has no matching source slot is set to `failed/unknown` through the status manager but without an event (`ImageCopyFacade.php:189-192`); the client learns it only from the `status` inside the `asset_file_copied` payload or from a read.
- **Is `asset_metadata_processed` dispatched for a copy?** **No, never.** Its single dispatch site is `MetadataProcessor.php:43`; the two callers of that method are the first-chunk handler and `process()` (`AssetFileMetadataProcessHandler.php:47`, `AbstractAssetFileStatusFacade.php:306`). The copy path (`ImageCopyFacade::copyAssetFiles` -> `AssetFileCopyBuilder::copy` -> `ImageFileCopyBuilder::copy`) calls neither.
- **Is it dispatched before `asset_file_copied`?** Not applicable; it is not dispatched at all. A client that waits for it on a copy waits forever.
- **Is the copy's metadata complete at `asset_file_copied`?** The asset-level metadata (`metadata.customData`, suggestions, `authors`, `keywords`, `texts`, `flags.described`) is complete **already when the PATCH responds** (step 2), so also at `asset_file_copied`.
- What is **not** carried over, at that moment or ever: the file-level `mainFile.metadata.exifData` stays `[]` (blank metadata from `AbstractAssetFileFactory.php:228-229`; `AssetFileCopyBuilder::copy` does not touch it) and the copy file's `flags.processedMetadata` stays `false` (only `singleUse` is copied, `AssetFileCopyBuilder.php:29`).
- **Inferred**: edits made to the source asset's metadata between the PATCH and the worker are not re-copied, since step 4 copies files only (`ImageCopyFacade.php:176-194`).

Poll equivalent for a copy: read `targetAsset` and wait until `mainFile.fileAttributes.status` is no longer `uploading`. `mainFile.originAssetFile` then equals the source file id and `attributes.assetStatus` is `with_file`.

### 4e. Audio, video, document

Same controllers shape, same base facade, same statuses and the same event names. Differences:

| | Image | Audio | Video | Document |
|---|---|---|---|---|
| create / chunk / get / finish | `ImageController.php:96,187,203,219` | `AudioController.php:89,183,200,216` | `VideoController.php:90,233,249,264` | `DocumentController.php:86,181,197,213` |
| queue routing | `AnzuSystemsCoreDamExtension.php:432` | `:430` | `:429` | `:431` |
| ack deadline | 60 s (`:174`) | 300 s (`:238`) | 500 s (`:270`) | 120 s (`:206`) |
| processing step | resizes, ROI (`ImageStatusFacade.php:45-61`) | ffmpeg attributes (`B/Domain/Audio/AudioStatusFacade.php:36-45`) | attributes + preview image (`B/Domain/Video/VideoStatusFacade.php:68-92`) | none (`B/Domain/Document/DocumentStatusFacade.php:29-32`) |
| `exifData` readable | yes | no | no | no |
| copy to licence | yes | no: `AssetFileCopyBuilder.php:31-43` throws for non-image | no | no |

- First-chunk metadata processing applies to all four types (`ChunkFacade.php:57-59` does not look at the type); image-specific exif tags are merged only for images (`AssetMetadataProcessor.php:45-50`).
- Video creates a second, system-generated image asset for its preview by running the image pipeline synchronously inside the video worker (`VideoStatusFacade.php:51-61`, `AbstractAssetFileFactory.php:75-89`). **Inferred**: that image has no `notifyTo` (created without a request, `AbstractManager.php:106`), so no events are pushed for it.
- Audio, app-specific: on `processed` (and on `duplicate`, for the original) a listener on the same Symfony event creates the public route (`APP/src/Event/Listener/AudioFileProcessedListener.php:29-59`). `mainRoute` is readable on the audio detail (`AudioFileAdmDetailDto.php:42-49`). **Inferred**: it can appear a moment after `status = processed`.
- Upload "from external provider" queues a `VideoFileChangeStateMessage` whatever the asset type (`AbstractAssetFileFacade.php:181`), so an Unsplash image is processed on the video queue. The file starts in `uploaded` (`AbstractAssetFileFactory.php:328-333`), so there is no `asset_file_uploaded` and no first-chunk metadata message for it; metadata runs in `process()`.

### 4f. Slots (a second file in an asset)

- `POST /api/adm/v1/{image|audio|video|document}/asset/{asset}/slot-name/{slotName}` creates the file and its slot (`ImageController.php:117-128`, `AbstractAssetFileFacade.php:248-281`); a taken slot is refused (`:256-260`). Chunks and finish are the same endpoints as for a first file.
- **Events are identical** to a first upload. The payload identifies the file: `asset` = asset id, `id` = file id (`AsseFileAdmNotificationDecorator.php:11-15`).
- The asset detail serializes **only `mainFile`** (`AssetAdmDetailDto.php:147-151`); a second file is not the main file (`AssetSlotFactory.php:29,36-39`). So `GET asset` cannot tell that a non-main file settled.
- A poll sees it through either:
  - `GET /api/adm/v1/asset-slot/asset/{asset}`: all slots, each with `slotName`, `default`, `main` and the file in **detail** view including `fileAttributes.status`, `failReason`, `originAssetFile` (`B/Controller/Api/Adm/V1/AssetSlotController.php:38-45`, `B/Model/Dto/AssetSlot/AssetSlotAdmListDecorator.php:40-62`);
  - `GET /api/adm/v1/image/{image}` (or audio/video/document), by the file id returned from the create call (`ImageController.php:203-210`).
- Metadata for a second file: exif is written to that file; custom-data autocomplete is skipped once the asset is autocompleted or described (`MetadataProcessor.php:35-37`), and the suggesters are skipped once described (`B/Domain/AssetMetadata/Suggestion/AbstractSuggester.php:43-50`).

---

## 5. Endpoints a poll could use

All are served from the database (Doctrine), not from Elasticsearch, unless stated. Prefix `/api/adm/v1`.

| Route | Controller | Returns | ACL |
|---|---|---|---|
| `GET /asset/{asset}` | `AssetController.php:168-175` | `AssetAdmDetailDto`: attributes (type, status), texts, flags, licence, metadata, authors, keywords, `mainFile` in detail view, `assetFileProperties` | `dam_asset_read` on the asset |
| `GET /asset/asset-file/{assetFile}` | `AssetController.php:180-187` | the same DTO, looked up by a file id | `dam_asset_read` on the asset |
| **`GET /asset/licence/{assetLicence}/ids/{ids}`** | `AssetController.php:139-150` | `{totalCount, data: AssetAdmDetailDto[]}`, the **full detail DTO per asset** (`B/Repository/Decorator/AssetAdmRepositoryDecorator.php:36-45`). `ids` comma-separated, **max 50** (`AssetController.php:55,142`; `APP/vendor/anzusystems/common-bundle/src/Model/Attributes/ArrayStringParam.php:13,21`). Only assets of that licence are returned (`B/Repository/AssetRepository.php:82-92`). | `dam_asset_read` on the licence |
| `GET /asset/ext-system/{extSystem}/ids/{ids}` | `AssetController.php:152-163` | same shape, across licences of one ext system (`AssetRepository.php:113-125`) | `dam_asset_read` with the ext system as subject (`:158`) |
| `GET /image/{image}` (`/audio/..`, `/video/..`, `/document/..`) | `ImageController.php:203-210`, `AudioController.php:200`, `VideoController.php:249`, `DocumentController.php:197` | file detail DTO: `fileAttributes.status`, `failReason`, `originAssetFile`, flags, type attributes | `dam_image_read` etc. on the file |
| `GET /asset-slot/asset/{asset}` | `AssetSlotController.php:38-45` | all slots with their files in detail view | `dam_asset_read` on the asset |
| `GET /asset/licence/{assetLicence}/search`, `/asset/licence/search` | `AssetController.php:92-103`, `:111-121` | list DTOs from **Elasticsearch** | `dam_asset_read` |
| `GET /distribution/{distribution}` | `B/Controller/Api/Adm/V1/DistributionController.php:60-67` | the distribution, incl. `status`, `failReason`, `distributionData` (`B/Entity/Distribution.php:80-89`) | `dam_distribution_access` on the distribution |
| `GET /distribution/asset/{asset}` | `DistributionController.php:72-81` | list for an asset | `dam_asset_read` on the asset |
| `GET /distribution/asset-file/{assetFile}` | `DistributionController.php:86-95` | list for a file | `dam_asset_read` on the file |
| `GET /distribution/{distributionService}/authorized` | `DistributionController.php:97-106` | the service name and an authorized boolean (getters `getDistributionService`, `isAuthorized`, `B/Model/Decorator/DistributionServiceAuthorization.php:24-39`; exact serialized key of the boolean not checked) | `dam_distribution_access` on the service name |
| `GET /distribution/search` | `DistributionController.php:48-55` | Elasticsearch | `dam_distribution_read` |
| `GET /user/current`, `GET /anzu-user/current` | `APP/src/Controller/Api/Adm/V1/UserController.php:48`, `AnzuUserController.php:45` | current user | logged in |

- **There is no light, status-only endpoint for a file.** A search of the adm controllers for status, state or id-list routes finds only the four `finish_upload` routes and the two asset `ids` routes above (plus an unrelated external-provider one). There is also no read of several **files** by ids; the batch read is per asset.
- ACL meaning: the permission plus licence membership, i.e. the user is admin or user of the licence's ext system, or has the licence, or has it through a licence group (`B/Security/Voter/AssetLicenceAwareVoter.php:24-41`, `B/Security/Voter/LicenceVoterTrait.php:12-19`). An uploader necessarily has this for the licence being uploaded to.
- For the ext-system variant several voters support `dam_asset_read` and they disagree on an `ExtSystem` subject (`AssetLicenceAwareVoter.php:34-36` refuses, `B/Security/Voter/AssetExtSystemAdminVoter.php:29-33` grants ext-system admins only). The effective result depends on the decision strategy, which I did not resolve. The per-licence variant has no such ambiguity.
- A distribution read needs the user permission and read access to both its asset and its file (`B/Security/Voter/DistributionVoter.php:44-55`).
- Asset and file reads pass no cache settings to `okResponse` (`AssetController.php:174`; `APP/vendor/anzusystems/common-bundle/src/Controller/AbstractAnzuApiController.php:33-43`), unlike the configuration endpoint (`ConfigurationController.php:38-41`). **Inferred**: polls are not served from the proxy cache.
- The search endpoints are unsuitable for status polling: the index is written at specific points only (`AbstractAssetFileFacade.php:231`, `RefreshAssetPropertiesHandler.php:43`) and trails the database.

---

## 6. The other events: when, and what a client reads instead

| Event | When sent | Read instead |
|---|---|---|
| `asset_file_uploaded` | inside the `PATCH .../uploaded` request (`AbstractAssetFileStatusFacade.php:194-196`) | nothing to poll: the response of that same request is the file with `status: uploaded` (`ImageController.php:227-231`) |
| `asset_deleted` | two steps. `DELETE /asset/{asset}` sets `deleting` and queues a message (`AssetController.php:252-263`, `AssetFacade.php:120-124`, `:207-223`); the worker deletes files and asset and, after commit, dispatches the file events then the asset event (`B/Messenger/Handler/AssetChangeStateHandler.php:31-64`, `AssetFacade.php:126-158`). Also from the nightly cleanup of unfinished uploads older than a week (`AssetFacade.php:43-44,106-118`; cron `anzu-dam:asset:clear` at `APP/docker/crontab/crontab:32`, matched to `B/Command/ClearUnfinishedUploadsCommand.php` by name only), licence retention and the GDPR job. | `GET /asset/{id}`: `attributes.assetStatus = deleting` between the two steps, then 404. In the batch read the id disappears from `data` (**inferred** from `findBy`, `AssetRepository.php:82-92`). |
| `asset_file_deleted` | single file: synchronously in `DELETE /image/{image}` after commit (`ImageController.php:271-281`, `AbstractAssetFileFacade.php:286-335`). With an asset: see above. Also a nightly job removes non-main `duplicate`/`failed` files older than a week (`AbstractAssetFileFacade.php:45-46,186-211`, `B/Repository/AbstractAssetFileRepository.php:100-114`; cron `anzu-dam:asset-file:clear` at `APP/docker/crontab/crontab:35`, matched to `B/Command/ClearDuplicatesAndFailedFilesCommand.php` by name only). | the DELETE answers 204 to the caller. For others: file GET 404, or `GET /asset-slot/asset/{asset}`; the asset returns to `draft` when its last slot is gone (`AbstractAssetFileFacade.php:303-305`). |
| `distribution_distributing` | worker picks up a `waiting` distribution (`B/Messenger/Handler/DistributeHandler.php:42-44`, `B/Distribution/DistributionBroker.php:72-74`); or synchronously on redistribute (`DistributionBroker.php:57-67`) | `GET /distribution/{id}` or `/distribution/asset/{asset}`: `status` |
| `distribution_failed` | module threw (`DistributionBroker.php:79-98`) or the remote side reported failure (`:123-131`) | same; `failReason` is on the entity (`B/Entity/Distribution.php:84-85`) and is **not** in the event payload, so a read is needed already today |
| `distribution_remote_processing` | after hand-off to a remote-processing module such as JW Player or Youtube (`DistributionBroker.php:100-105`) | same |
| `distribution_distributed` | `DistributionBroker.php:139-147`; it also queues the asset property refresh (`:142`) | same; afterwards `assetFileProperties.distributesInServices` on the asset (`AssetPropertiesRefresher.php:54-68`) |
| `distribution_authorized` | Youtube OAuth callback `GET /youtube/code` exchanges the code, dispatches the event and redirects the popup (`B/Controller/YoutubeController.php:19,33-41`, `YoutubeAuthenticator.php:84-97`) | `GET /distribution/{distributionService}/authorized` |
| `user_updated` | after any of six user update paths (`APP/src/Domain/User/UserFacade.php:60,73,86`; `DeprecatedUserFacade.php:39,69,82`), to the updated user | `GET /user/current` |

All four distribution status events are emitted after the status change is committed (`DistributionStatusFacade.php:47-59`). Finished states are `distributed` and `failed`; unfinished are `waiting`, `distributing`, `remote_processing` (`B/Model/Enum/DistributionProcessStatus.php:18-27`).

---

## 7. Timing: how processing is queued

No duration is stated anywhere in code or config for image processing. What the code does tell:

- **Everything after `PATCH .../uploaded` is asynchronous** through Symfony Messenger on Google Pub/Sub (`APP/.env:120` `gps://default`, forced REST transport `APP/config/packages/petit_press_gps_messenger.php:8-10`).
- **Local development is different**: `APP/.env.local:122` sets `MESSENGER_TRANSPORT_DSN=sync://`. **Inferred**: locally the whole pipeline runs inside the HTTP request, so `PATCH .../uploaded` returns the terminal status and nothing is ever "pending". A polling implementation tested only against a local backend never exercises its waiting path.
- **Queues involved in one image upload**: metadata (`anzu_core_dam_asset_file_metadata_process`), image state (`anzu_core_dam_image_file_change_state`), property refresh (`anzu_core_dam_property_refresh`); a copy uses `anzu_core_dam_asset_copy` (names `APP/.env:123-133`, routing `AnzuSystemsCoreDamExtension.php:428-440`).
- **One consumer process per queue per pod**: `SUPERVISOR_MESSENGER_NUMPROCS: "1"` (`APP/docker/kubernetes/configuration.yaml:195`), with "max 1 consumer per subscription" recorded as a deliberate change (`APP/doc/Core-Dam-Changelog/1.3.0.md:5`). Pod count comes from HPA placeholders whose values are not in the repo (`APP/docker/kubernetes/messenger-deployment.yaml:351-352`).
- **Workers are recycled** after `SUPERVISOR_MESSENGER_LIMIT: "10"` messages or `SUPERVISOR_MESSENGER_TIME_LIMIT: "600"` seconds (`configuration.yaml:194,196`). The script that turns these into `messenger:consume` flags is in the base image, not in the repo; the mapping is **inferred** from the names.
- **Serial per licence**: store and process run under a lock named `<assetType>_<licenceId>` (`AbstractAssetFileStatusFacade.php:207,215,224`). **Inferred**: N images uploaded to one licence are processed one after another even with several pods, so the wait for the last file grows roughly linearly with N. This is the main reason a fixed short timeout would be wrong for bulk uploads.
- **Pull batch**: up to 10 messages per pull (`GPS/Transport/GpsConfigurationResolverInterface.php:10`, `GpsConfigurationResolver.php:76`).
- **Ack deadlines** (redelivery if not acked in time): image 60 s (`AnzuSystemsCoreDamExtension.php:174`), document 120 s (`:206`), audio 300 s (`:238`), video 500 s (`:270`), metadata 120 s (`:334`), copy 120 s (`:422`), property refresh 60 s (`:394`), asset delete 60 s (`:302`), distribution 600 s (`:366`).
- **Retry**: a rejected message is nacked and redelivered by Pub/Sub under the subscription's retry policy (`GPS/Transport/GpsReceiver.php:78-93`; `use_messenger_retry` defaults to false, `GPS/Transport/GpsConfigurationResolver.php:52`): 2 s to 600 s backoff on the file queues (`AnzuSystemsCoreDamExtension.php:175-178`, `:207-210`, `:239-242`, `:271-274`). No Symfony `retry_strategy` or failure transport is configured (grep over `APP/config` and both bundles: no match).
- In practice processing errors are **not retried**: `storeAndProcess` catches every `Throwable` and turns it into `failed` (`AbstractAssetFileStatusFacade.php:237-252`). A retry happens only if that handling itself throws (`AssetFileChangeStateHandler.php:101-114`).
- A file found in `stored` on redelivery is re-processed from storage with the log line "possible killed by k8s" (`AssetFileChangeStateHandler.php:90,123-146`): a worker killed mid-processing leaves the file in `stored` until Pub/Sub redelivers, i.e. up to the ack deadline plus backoff.
- **Remote distribution check** is itself a poll on the server: while the remote side is not ready the handler throws `RemoteProcessingWaitingException` (`B/Distribution/Modules/JwPlayerDistributionModule.php:95-97`) and the message is redelivered with 30 s to 90 s backoff (`AnzuSystemsCoreDamExtension.php:142-146`). A client polling a distribution faster than that learns nothing sooner during `remote_processing`.
- Sizes: chunk 1 MB to 50 MB (`APP/.env:226-227`); max image 100 MB, document 100 MB, audio 1 GB, video 5 GB (`APP/.env:229-232`). Image processing runs with `VIPS_CONCURRENCY: "2"` (`configuration.yaml:199`).
- Each notification is a synchronous REST publish with a freshly built client (`AbstractNotificationDispatcher.php:69-82`); an image upload makes four to five of them (uploaded, metadata, stored, processed). Disabling notifications removes those calls from the request and the worker.

---

## 8. Other facts that matter for the retirement

### 8.1 A failed publish can fail an upload (inferred from the code path, not executed)

`notify()` and the subscribers have no error handling (2.1), and the status events are dispatched from inside `storeAndProcess`'s `try` block:

- `store()` is called at `AbstractAssetFileStatusFacade.php:216` inside the `try` opened at `:209`; it dispatches the `stored` event at `:289`, after its commit.
- `process()` is called at `:223`; it dispatches the `processed` event at `:318`, after its commit.
- Any `Throwable` is caught at `:245` and handled by `toFailed(unknown)` (`:247-251`). Both `stored -> failed` and `processed -> failed` are allowed transitions (`AssetFileStatusManager.php:126-128`).

So if the Pub/Sub publish throws (topic removed, credentials revoked, outage), a file that was stored or fully processed is marked `failed/unknown`. In the same way an exception at `:196` during `PATCH .../uploaded` would return an error after the status was already flushed to `uploaded` (`:194`) and before the processing message is queued (`:197`), leaving the file stuck in `uploaded`.

Consequence for the order of work: stopping the Node service is harmless for DAM, because publishing to a topic with no subscriber succeeds. **Deleting the topic or its credentials while `notifications.enabled` is still true is not harmless.** That a publish to a missing topic throws is my assumption about the Google client; I did not read it.

### 8.2 Existing gaps the push has today

- No replay (1, item 11): an event published during a reconnect is lost, so a push-only client already needs a read to recover.
- `asset_metadata_processed` can be published before its transaction commits (3).
- The property refresh after `processed` has no event (3, step 4).
- `distribution_failed` carries no reason (6).
- Events follow `notifyTo`, which another user can take over (2.3).

---

## 9. `/home/volar/projects/petit/notification`: a different service, unrelated

- "Anzu Notification" (`/home/volar/projects/petit/notification/README.md:1`), an Azure DevOps repo, package `notification` 1.0.0: Express API + TypeORM/MySQL + MongoDB + Redis + Firebase push + socket.io + mailer, with user/device/topic subscriptions and notification history (`/home/volar/projects/petit/notification/src/index.ts:2-25,36-49`). Its Pub/Sub topic is `notification_server`, not `notification_server_internal` (`/home/volar/projects/petit/notification/.env.dist:8`).
- It is the CMS/editorial end-user notification product, not the DAM upload push. DAM only declares an unused scoped HTTP client for it (`APP/config/packages/clients.php:27-31`; grep finds no use of `anzu_notification` in `APP/src`). Retiring `anzusystems/notification-server` does not touch it.

---

## 10. Proposals (mine, not facts)

**P1. Close the one real gap: expose the metadata flag.** Add `processedMetadata` to `AssetFileFlagsAdmDto` (`B/Model/Dto/AssetFile/Embeds/AssetFileFlagsAdmDto.php:12-32`). The column already exists and is already maintained; this is a serialization-only change in the bundle and gives a poller the exact equivalent of `asset_metadata_processed`, readable on `mainFile.flags.processedMetadata`. Two things to settle with it: copies keep `false` forever (4d), so either copy the flag in `AssetFileCopyBuilder::copy` or have the frontend not wait for it on a copy; and the DTO is also used for `PUT /image/{id}` input (`ImageController.php:257`), so the new field must be read-only.

**P2. Until P1 ships, a rule that needs no backend change.** Treat metadata as ready when the file status is `processed` (guaranteed, 4a), and for `duplicate`/`failed` treat the file as settled without waiting for metadata. The cost against today: the metadata form unlocks at the end of processing instead of during the chunk upload. For images a non-empty `mainFile.metadata.exifData` can be used as an early positive hint, never as a negative one.

**P3. Poll with the batch read.** `GET /api/adm/v1/asset/licence/{licence}/ids/{ids}` returns the full detail DTO for up to 50 assets from the database in one request. An upload queue targets one licence, so one request per tick covers the whole queue; chunk the ids at 50. It also sidesteps the voter ambiguity of the ext-system variant.

**P4. Terminal conditions.**
- Upload: `mainFile.fileAttributes.status` in `processed | duplicate | failed`. `stored` is not terminal.
- Copy: only when the PATCH answered `result: copy`; done when the target's `mainFile.fileAttributes.status != uploading`. For `exists` and `notAllowed` there is nothing to wait for.
- Slot upload: poll `GET /asset-slot/asset/{asset}` (or the file GET) and match by file id, because the asset detail shows only the main file.
- Decide duplicate by `status`, never by `originAssetFile` being non-empty.

**P5. Schedule.** Start when `PATCH .../uploaded` returns (it already says `uploaded`). Back off, e.g. 1 s for the first few ticks, then 2 s, then 5 s, then 10 s. Do not turn a timeout into a failure: processing is serial per licence and workers restart every 10 messages, so a large batch legitimately takes long. After a soft limit (a couple of minutes for images, much longer for audio/video given their 300 s/500 s ack deadlines) show "still processing" and keep polling slowly. Stop on terminal status, on 404, or when the queue is dismissed. Test against a backend with a real async transport, not `sync://`.

**P6. One delayed re-read after terminal.** To pick up the property refresh that has no signal (`displayTitle`, width/height), re-read once a few seconds after `processed`, or accept that these fields refresh on the next natural reload.

**P7. Order of retirement.** (1) Frontends stop needing the push. (2) Set `anzu_systems_core_dam.settings.notifications.enabled: false` in DAM. This stops publishing, removes the per-transition REST call and removes the coupling in 8.1. (3) Only then remove the service, topic and credentials. Do not remove the topic while the flag is on. The per-ext-system `notifications_enabled` could serve as a staged rollout switch, and the frontend can already read it from the ext-system configuration endpoint.

**P8. The other events without push.**
- Distribution: poll `GET /distribution/asset/{asset}` every 10 s or so while any item is `waiting | distributing | remote_processing`; faster gains nothing during remote processing.
- `distribution_authorized`: while the OAuth popup is open, poll `GET /distribution/{service}/authorized`.
- `user_updated`: re-read the current user on window focus or navigation.
- Deletes: remove optimistically on the 204, treat 404 on later reads as deleted.

**P9. Optional, lower priority: a light status endpoint.** If the detail DTO proves too heavy at 50 assets per tick, a `GET` by file ids returning `{id, asset, status, failReason, assetType, originAssetFile, processedMetadata}` would mirror the current push payload exactly (`AssetFileStatusAdmNotificationDecorator`), letting the frontend feed poll results through the same handler as push events. Not needed for step one.

---

## 11. Not verified

- Whether bundle 1.52.0 is the latest upstream release.
- Production values: the notification topic env, HPA replica counts, the supervisor script that builds the `messenger:consume` command.
- The Symfony access-decision strategy (relevant only to the ext-system ids endpoint).
- Behaviour of the Google client on publish to a missing topic (8.1 assumes it throws).
- Container compilation with notifications disabled (assumed from the test config, not run).
- Nothing was executed; all sequence and race statements come from reading the code.
