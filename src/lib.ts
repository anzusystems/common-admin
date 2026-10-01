import ABooleanValue from '@/domains/ui/components/ABooleanValue.vue'
import ARow from '@/domains/ui/components/ARow.vue'
import AAlerts from '@/domains/system/components/AAlerts.vue'
import AActionbar from '@/domains/system/appShell/components/AActionbar.vue'
import AActionbarTarget from '@/domains/system/appShell/components/AActionbarTarget.vue'
import ALayoutLoader from '@/domains/system/appShell/components/ALayoutLoader.vue'
import ALayoutSwitch from '@/domains/system/appShell/components/ALayoutSwitch.vue'
import {
  actionbarSlot,
  createTeleportSlot,
  type TeleportSlot,
} from '@/domains/system/appShell/composables/teleportSlot'
import AProgress from '@/domains/ui/components/AProgress.vue'
import ACard from '@/domains/ui/components/ACard.vue'
import AFormTextField from '@/domains/form/components/AFormTextField.vue'
import AFormTextarea from '@/domains/form/components/AFormTextarea.vue'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import ADatatableConfigButton from '@/domains/filters/datatable/components/ADatatableConfigButton.vue'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import ACreateDialog from '@/domains/ui/components/ACreateDialog.vue'
import AAdminSwitcher from '@/domains/system/components/AAdminSwitcher.vue'
import ATimeTrackingFields from '@/domains/ui/components/ATimeTrackingFields.vue'
import Acl from '@/domains/auth/components/Acl.vue'
import ADatetime from '@/domains/ui/datetime/components/ADatetime.vue'
import ADatetimePicker from '@/domains/ui/datetime/components/ADatetimePicker.vue'
import type { DatetimePickerType } from '@/shared/utils/datetimePickerValue'
import AFormDatetimePicker from '@/domains/form/components/AFormDatetimePicker.vue'
import AFormFlagDatetimePicker from '@/domains/form/components/AFormFlagDatetimePicker.vue'
import AFormRemoteCheckbox from '@/domains/form/components/AFormRemoteCheckbox.vue'
import AFormSwitch from '@/domains/form/components/AFormSwitch.vue'
import AFormRemoteSwitch from '@/domains/form/components/AFormRemoteSwitch.vue'
import AFormValueObjectOptionsSelect from '@/domains/form/components/AFormValueObjectOptionsSelect.vue'
import AJobStatusChip from '@/domains/job/components/AJobStatusChip.vue'
import ACachedChip from '@/domains/cached/components/ACachedChip.vue'
import ACopyText from '@/domains/ui/components/ACopyText.vue'
import AIconGroup from '@/domains/ui/components/AIconGroup.vue'
import AChipNoLink from '@/domains/ui/components/AChipNoLink.vue'
import ACollabLockedByUser from '@/domains/collab/components/ACollabLockedByUser.vue'
import ACollabManagement from '@/domains/collab/components/ACollabManagement.vue'
import AUserAndTimeTrackingFields from '@/domains/ui/components/AUserAndTimeTrackingFields.vue'

import AActionCloseButtonHistory from '@/domains/ui/buttons/action/components/AActionCloseButtonHistory.vue'
import AActionCreateButton from '@/domains/ui/buttons/action/components/AActionCreateButton.vue'
import AActionDeleteButton from '@/domains/ui/buttons/action/components/AActionDeleteButton.vue'
import AActionEditButton from '@/domains/ui/buttons/action/components/AActionEditButton.vue'
import AActionSaveAndCloseButton from '@/domains/ui/buttons/action/components/AActionSaveAndCloseButton.vue'
import AActionSaveButton from '@/domains/ui/buttons/action/components/AActionSaveButton.vue'
import ATableCopyIdButton from '@/domains/ui/buttons/table/components/ATableCopyIdButton.vue'
import ATableDetailButton from '@/domains/ui/buttons/table/components/ATableDetailButton.vue'
import ATableEditButton from '@/domains/ui/buttons/table/components/ATableEditButton.vue'
import ABtnSplit from '@/domains/ui/buttons/components/ABtnSplit.vue'
import AThemeSelect from '@/domains/system/components/AThemeSelect.vue'
import ALanguageSelect from '@/domains/system/components/ALanguageSelect.vue'
import ASystemBar from '@/domains/system/systemBar/components/ASystemBar.vue'
import AAnzuUserAvatar from '@/domains/ui/components/AAnzuUserAvatar.vue'
import AAvatarColorPicker from '@/domains/ui/components/AAvatarColorPicker.vue'
import ACurrentUserDropdown from '@/domains/ui/components/ACurrentUserDropdown.vue'
import ALoginView from '@/domains/ui/view/components/ALoginView.vue'
import ALogoutView from '@/domains/ui/view/components/ALogoutView.vue'
import AUnauthorizedView from '@/domains/ui/view/components/AUnauthorizedView.vue'
import ANotFoundView from '@/domains/ui/view/components/ANotFoundView.vue'
import AGenericView from '@/domains/ui/view/components/AGenericView.vue'
import AJobDetailCommon from '@/domains/job/components/AJobDetailCommon.vue'
import AJobPriorityChip from '@/domains/job/components/AJobPriorityChip.vue'
import AJobBaseCreateForm from '@/domains/job/components/AJobBaseCreateForm.vue'
import AFileInput from '@/domains/ui/file/components/AFileInput.vue'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AAssetListInner from '@/domains/dam/assetSelect/components/AAssetListInner.vue'

import ACustomDataForm from '@/domains/customDataForm/components/ACustomDataForm.vue'
import ACustomDataFormElement from '@/domains/customDataForm/components/ACustomDataFormElement.vue'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import AImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import AImageMediaWidget from '@/domains/dam/imageWidget/components/AImageMediaWidget.vue'
import AImageWidgetSimple from '@/domains/dam/imageWidget/components/AImageWidgetSimple.vue'
import AMediaWidgetSimple from '@/domains/dam/imageWidget/components/AMediaWidgetSimple.vue'
import AImageWidgetMultiple from '@/domains/dam/imageWidget/components/AImageWidgetMultiple.vue'
import AImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import AImageWidgetMultipleSimple from '@/domains/dam/imageWidget/components/AImageWidgetMultipleSimple.vue'
import AImageMassOperations from '@/domains/dam/imageWidget/components/ImageMassOperations.vue'
import AImagePublicInput from '@/domains/dam/imageWidget/components/AImagePublicInput.vue'
import ADamAssetImageRoiSelect from '@/domains/dam/cropper/components/DamAssetImageRoiSelect.vue'
import ABooleanSelect from '@/domains/ui/components/ABooleanSelect.vue'
import {
  CustomDataFormElementType,
  CustomDataFormElementTypeDefault,
  type CustomDataFormElementTypeType,
  useCustomDataFormElementType,
} from '@/domains/customDataForm/types/CustomDataFormElementTypes'
import { generateDatatableMinMaxSelectStrategy } from '@/domains/subjectSelect/utils/selectStrategies'
import { type CommonAdminI18n, slovakPluralizationRule } from '@/plugins/i18n'
import {
  type Immutable,
  objectDeepFreeze,
  objectDeletePropertyByPath,
  objectGetValueByPath,
  objectSetValueByPath,
} from '@/shared/utils/object'
import {
  cloneDeep,
  isArray,
  isBoolean,
  isDefined,
  isDocId,
  isEmpty,
  isEmptyObject,
  isFunction,
  isInt,
  isNull,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from '@/shared/utils/common'
import {
  stringIsValidEmail,
  stringSplitOnFirstOccurrence,
  stringToFloat,
  stringToInt,
  stringToKebabCase,
  stringToSlug,
  stringToBooleanExact,
} from '@/shared/utils/string'
import { booleanToInteger } from '@/shared/utils/boolean'
import { isOneOf } from '@/shared/utils/enum'
import {
  dateDiff,
  type DateDiffUnit,
  dateModifyMinutes,
  dateNow,
  datePretty,
  dateUtcPretty,
  dateUtcToday,
  DATETIME_MAX,
  DATETIME_MIN,
  dateTimeEndOfDay,
  dateTimeFriendly,
  dateTimeNow,
  dateTimePretty,
  dateTimeStartOfDay,
  dateTimeToDate,
  dateToUtc,
  timePretty,
} from '@/shared/utils/datetime'
import { Grant, type GrantType, useGrant } from '@/domains/auth/valueObject/Grant'
import {
  GrantOrigin,
  GrantOriginDefault,
  type GrantOriginType,
  useGrantOrigin,
} from '@/domains/permission/valueObject/GrantOrigin'
import { useAnzuUserFactory } from '@/domains/anzuUser/factory/AnzuUserFactory'
import { usePermissionConfigFactory } from '@/domains/permission/config/factory/PermissionConfigFactory'
import { usePermissionGroupFactory } from '@/domains/permission/group/factory/PermissionGroupFactory'
import type {
  DatetimeUTC,
  DatetimeUTCNullable,
  DateUTC,
  DocId,
  DocIdNullable,
  IntegerId,
  IntegerIdNullable,
} from '@/shared/types/common'
import type { AnzuUser, AnzuUserMinimal, BaseUser } from '@/shared/types/AnzuUser'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import type { PermissionConfig, PermissionTranslationGroup } from '@/domains/permission/config/types/PermissionConfig'
import type { AnzuUserAndTimeTrackingAware } from '@/shared/types/AnzuUserAndTimeTrackingAware'
import type { PermissionGroup, PermissionGroupMinimal } from '@/domains/permission/group/types/PermissionGroup'
import { type CreatedByAware } from '@/shared/types/CreatedByAware'
import type { VuetifyIconValue } from '@/shared/types/Vuetify'
import {
  type NavigateBackOptions,
  type RouteHistoryEntry,
  useRouteHistory,
} from '@/domains/system/composables/routeHistory'
import { SubjectScopeKey, SystemScopeKey } from '@/shared/injectionKeys'
import { prettyBytes, prettyDuration } from '@/shared/utils/file'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_UNPROCESSABLE_ENTITY,
} from '@/shared/statusCodes'
import { AnzuApiResponseCodeError, isAnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import {
  AnzuApiValidationError,
  type AnzuApiValidationResponseData,
  axiosErrorResponseHasValidationData,
  hasAnzuApiValidationErrorSpecific,
  isAnzuApiValidationError,
  type ValidationError,
} from '@/shared/error/AnzuApiValidationError'
import {
  AnzuApiDependencyExistsError,
  axiosErrorResponseHasDependencyExistsData,
  isAnzuApiDependencyExistsError,
} from '@/shared/error/AnzuApiDependencyExistsError'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { isAnzuFatalError } from '@/shared/error/AnzuFatalError'
import { AnzuApiAxiosError, isAnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiTimeoutError, isAnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'
import { AnzuApiCancelledError, isAnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AnzuError, isAnzuError } from '@/shared/error/AnzuError'
import { NEW_LINE_MARK, type RecordWasType, useAlerts } from '@/domains/system/composables/alerts'
import { JobStatusDefault, type JobStatusType, useJobStatus } from '@/domains/job/valueObject/JobStatus'
import { JobStatus } from '@/domains/job/valueObject/JobStatus'
import type { JobBase, JobUserDataDelete } from '@/domains/job/types/Job'
import {
  JOB_RESOURCE_USER_DATA_DELETE,
  type JobBaseResource,
  useJobBaseResource,
} from '@/domains/job/valueObject/JobBaseResource'
import AnzuSystemsCommonAdmin, {
  type CommonAdminCollabOptions,
  type CommonAdminCoreDamOptions,
  type CommonAdminImageOptions,
  type PluginOptions,
} from '@/AnzuSystemsCommonAdmin'
import type {
  AclRegistry,
  AclValue,
  AclValueOf,
  Permissions,
  RegisteredAclValue,
} from '@/domains/auth/types/Permission'
import { Theme, type ThemeType, useTheme } from '@/domains/system/composables/themeSettings'
import {
  type LanguageCode,
  modifyLanguageSettings,
  useLanguageSettings,
} from '@/domains/system/composables/languageSettings'
import {
  arrayFlatten,
  arrayFromArgs,
  arrayItemToggle,
  arraysHaveSameElements,
  type NestedArray,
} from '@/shared/utils/array'
import { browserHistoryReplaceUrlByRouter } from '@/shared/utils/history'
import { eventClickBlur } from '@/shared/utils/event'
import type { ResourceNameSystemAware } from '@/shared/types/ResourceNameSystemAware'
import type { ACreateDialogValidation, AFormFieldValidation, ValidationScope } from '@/shared/types/Validation'
import type { CommonAdminGlobalComponents } from '@/shared/types/globalComponents'
import messagesCs from '@/locales/cs'
import messagesEn from '@/locales/en'
import messagesSk from '@/locales/sk'
import type { Log } from '@/domains/log/types/Log'
import { LogLevel, type LogLevelType } from '@/domains/log/valueObject/LogLevel'
import '@/styles/main.scss'
import { COMMON_CONFIG } from '@/shared/commonConfig'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'
import type { ApiInfiniteResponseList } from '@/domains/api/types/ApiResponse'
import {
  type DatatableOrderingOption,
  type DatatableOrderingOptions,
  type DatatableSortBy,
  SORT_BY_ID,
  SORT_BY_SCORE,
  SORT_BY_SCORE_BEST,
  SORT_BY_SCORE_DATE,
} from '@/domains/filters/datatable/utils/datatableColumns'
import { SortOrder, type SortOrderType } from '@/domains/api/types/SortOrder'
import { createAnzuVuetify, type CreateAnzuVuetifyOptions, useCommonVuetifyConfig } from '@/plugins/commonVuetifyConfig'
import { type CachedItem, defineCached } from '@/domains/cached/composables/defineCached'
import type { ObjectLeaves, UniqueValues } from '@/shared/types/utils'
import { ensureUniqueValues } from '@/shared/types/utils'
import { loadCommonFonts } from '@/plugins/webfontloader'
import {
  AnzuApiForbiddenError,
  axiosErrorResponseIsForbidden,
  isAnzuApiForbiddenError,
} from '@/shared/error/AnzuApiForbiddenError'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
  isAnzuApiForbiddenOperationError,
} from '@/shared/error/AnzuApiForbiddenOperationError'
import { useCommonJobFactory } from '@/domains/job/factory/JobFactory'
import type { UrlParams } from '@/domains/api/utils/apiHelper'
import { generateUUIDv1, generateUUIDv4 } from '@/shared/utils/generator'
import { localTimeShiftInSeconds, useLoginStatus } from '@/domains/system/composables/loginStatus'
import { useRemainingTime } from '@/domains/ui/datetime/composables/remainingTime'
import {
  type AssetCustomData,
  type AssetDetailItemDto,
  type AssetFileProperties,
  type AssetMetadataDto,
  type AssetMetadataSuggestions,
  type AssetSearchListItemDto,
  DamAssetStatus,
  DamAssetStatusDefault,
  type DamAssetStatusType,
  DamAssetType,
  DamAssetTypeDefault,
  type DamAssetTypeType,
  type DamDistributionServiceName,
} from '@/domains/dam/types/Asset'
import {
  type AssetFile,
  type AssetFileAudio,
  type AssetFileDocument,
  type AssetFileDownloadLink,
  AssetFileFailReason,
  type AssetFileFailReasonType,
  type AssetFileImage,
  type AssetFileImagePreviewNullable,
  assetFileIsAudioFile,
  assetFileIsImageFile,
  assetFileIsVideoFile,
  type AssetFileLink,
  type AssetFileLinks,
  AssetFileLinkType,
  type AssetFileLinkTypeType,
  type AssetFileMainRouteAware,
  type AssetFileNullable,
  AssetFileProcessStatus,
  type AssetFileProcessStatusType,
  type AssetFileRoute,
  AssetFileRouteStatus,
  type AssetFileRouteStatusType,
  type AssetFileVideo,
} from '@/domains/dam/types/AssetFile'
import {
  type DamUploadStartResponse,
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  UploadQueueItemType,
  type UploadQueueItemTypeType,
} from '@/domains/dam/types/UploadQueue'
import type {
  CustomDataAware,
  CustomDataFormElement,
  CustomDataFormElementAttributes,
  CustomDataValue,
} from '@/domains/customDataForm/types/CustomDataForm'
import {
  type AssetSelectReturnData,
  AssetSelectReturnType,
  type AssetSelectReturnTypeType,
} from '@/domains/dam/types/AssetSelect'
import type { SortableItemDataAware } from '@/shared/types/sortableUtils'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import {
  type DamDistributionConfig,
  type DamDistributionRequirementsCategorySelectConfig,
  type DamDistributionRequirementsConfig,
  DamDistributionRequirementStrategy,
  type DamDistributionRequirementStrategyType,
  DamDistributionServiceType,
  type DamDistributionServiceTypeType,
  DamDistributionStatus,
  type DamDistributionStatusType,
  type DamExternalProviderAssetConfig,
  type DamExternalProviderAssetName,
  type DamExtSystemAssetTypeExifMetadata,
  type DamExtSystemConfig,
  type DamExtSystemConfigItem,
  type DamExtSystemConfigItemImage,
  type DamPrvConfig,
  type DamPubConfig,
  UserAuthType,
  type UserAuthTypeType,
} from '@/domains/dam/types/DamConfig'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { getAssetTypeByMimeType } from '@/domains/dam/uploadQueue/utils/mimeTypeHelper'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'
import { damFileTypeFix } from '@/domains/ui/file/utils/fileType'
import { useDamAcceptTypeAndSizeHelper } from '@/domains/dam/config/composables/acceptTypeAndSizeHelper'
import { useAssetSuggestions } from '@/domains/dam/uploadQueue/composables/assetSuggestions'
import {
  destroyDamNotifications,
  initDamNotifications,
  useDamNotifications,
} from '@/domains/dam/composables/damNotifications'
import { useDropzoneGlobalDragState } from '@/domains/ui/file/composables/dropzone'
import { DamNotificationName, type DamNotificationNameType } from '@/domains/dam/composables/damNotificationsEventBus'
import type { ImageAware, ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type { ImageCreateUpdateAwareKeyed } from '@/domains/dam/types/ImageAware'
import type { DamAuthor, DamAuthorMinimal } from '@/domains/dam/author/types/DamAuthor'
import type { DamKeyword, DamKeywordMinimal } from '@/domains/dam/keyword/types/DamKeyword'
import type { DamExtSystem, DamExtSystemMinimal } from '@/domains/dam/types/DamExtSystem'
import { DamAuthorType, type DamAuthorTypeType, useDamAuthorType } from '@/domains/dam/author/types/DamAuthorType'
import { useDamKeywordFactory } from '@/domains/dam/keyword/factory/KeywordFactory'
import { useDamAuthorFactory } from '@/domains/dam/author/factory/AuthorFactory'
import type { DamCurrentUserDto } from '@/domains/dam/types/DamCurrentUser'
import type { DamAssetLicence, DamAssetLicenceMinimal } from '@/domains/dam/types/AssetLicence'
import type { DamAssetLicenceGroup } from '@/domains/dam/types/AssetLicenceGroup'
import { useCollabInit } from '@/domains/collab/composables/collabInit'
import { useCommonAdminCollabOptions } from '@/domains/collab/composables/commonAdminCollabOptions'
import { useCollabCurrentUserId } from '@/domains/collab/composables/collabCurrentUserId'
import { useCollabState } from '@/domains/collab/composables/collabState'
import { useCollabField } from '@/domains/collab/composables/collabField'
import { useCollabRoom } from '@/domains/collab/composables/collabRoom'
import {
  COLLAB_FIELD_PREFIX_COMMENT,
  COLLAB_FIELD_PREFIX_EMBED,
  type CollabCachedUsersMap,
  useCollabHelpers,
} from '@/domains/collab/composables/collabHelpers'
import { useCollabAnyDataChange } from '@/domains/collab/composables/collabAnyDataChange'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusPayload,
  type CollabFieldLockStatusType,
  CollabFieldLockType,
  type CollabFieldLockTypeType,
  type CollabGatheringBufferDataEvent,
  useCollabGatheringBufferDataEventBus,
  useCollabReconnectEventBus,
} from '@/domains/collab/composables/collabEventBus'
import {
  CollabAccessRoomStatus,
  type CollabAccessRoomStatusType,
  CollabChangeRoomLockStatus,
  type CollabChangeRoomLockStatusType,
  type CollabComponentConfig,
  type CollabFieldData,
  type CollabFieldDataEnvelope,
  type CollabFieldLock,
  type CollabFieldLockOptions,
  type CollabFieldName,
  CollabRequestToJoinStatus,
  type CollabRequestToJoinStatusType,
  CollabRequestToTakeModerationStatus,
  type CollabRequestToTakeModerationStatusType,
  type CollabRoom,
  type CollabRoomData,
  type CollabRoomInfo,
  CollabRoomJoinStrategy,
  type CollabRoomJoinStrategyType,
  type CollabRoomLocks,
  type CollabRoomOptions,
  type CollabRoomPlainData,
  type CollabRoomsInfo,
  CollabStatus,
  type CollabStatusType,
  type CollabUserId,
  type CollabUserIdNullable,
} from '@/domains/collab/types/Collab'
import ADamAssetLicenceRemoteAutocomplete from '@/domains/dam/user/components/DamAssetLicenceRemoteAutocomplete.vue'
import ADamAssetLicenceGroupRemoteAutocomplete from '@/domains/dam/user/components/DamAssetLicenceGroupRemoteAutocomplete.vue'
import ADamExtSystemRemoteAutocomplete from '@/domains/dam/user/components/DamExtSystemRemoteAutocomplete.vue'
import ADamExternalProviderAssetSelect from '@/domains/dam/user/components/DamExternalProviderAssetSelect.vue'
import ADamDistributionServiceSelect from '@/domains/dam/user/components/DamDistributionServiceSelect.vue'
import { useDamDistributionServiceType } from '@/domains/dam/user/types/DamDistributionServiceType'
import { useDamAssetLicenceInnerFilter } from '@/domains/dam/user/filter/AssetLicenceFilter'
import { fetchDamAssetLicenceListByIds, useFetchDamAssetLicenceList } from '@/domains/dam/user/api/assetLicenceApi'
import { fetchDamAssetLicenceGroupListByIds } from '@/domains/dam/user/api/assetLicenceGroupApi'
import { fetchDamExtSystemListByIds } from '@/domains/dam/user/api/extSystemApi'
import type { DamUser, DamUserUpdateDto } from '@/domains/dam/user/types/DamUser'
import { fetchDamUser, fetchDamUserListByIds, updateDamUser, useFetchDamUserList } from '@/domains/dam/user/api/userApi'
import { useImageActions } from '@/domains/dam/imageWidget/composables/imageActions'
import { useCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { defineAuth, ROLE_SUPER_ADMIN } from '@/domains/auth/composables/defineAuth'
import {
  type AuthCookieState,
  createRefreshRequestInterceptor,
  createRefreshSession,
  type RefreshResult,
} from '@/domains/auth/composables/refreshSession'
import { AuthUnavailableError } from '@/shared/error/AuthUnavailableError'
import { SessionExpiredError } from '@/shared/error/SessionExpiredError'
import { isInCauseChain } from '@/shared/error/isInCauseChain'
import { type BreadcrumbItem, type Breadcrumbs, defineBreadcrumbs } from '@/domains/system/composables/breadcrumbs'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ADamAuthorFilterRemoteAutocomplete from '@/domains/dam/author/components/DamAuthorFilterRemoteAutocomplete.vue'
import ADamKeywordFilterRemoteAutocomplete from '@/domains/dam/keyword/components/DamKeywordFilterRemoteAutocomplete.vue'
import ADamUserFilterRemoteAutocomplete from '@/domains/dam/user/components/DamUserFilterRemoteAutocomplete.vue'
import ADamUserRemoteAutocomplete from '@/domains/dam/user/components/DamUserRemoteAutocomplete.vue'
import ADamAdminAssetLink from '@/domains/dam/components/DamAdminAssetLink.vue'
import { useDamCachedUsers } from '@/domains/dam/author/composables/cachedUsers'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { isImageCreateUpdateAware, isMediaAware } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import type { DamMediaFromDam, ImageMediaCollabValue, MediaAware } from '@/domains/dam/types/MediaAware'
import { type DamMedia, DamMediaType, type DamMediaTypeType } from '@/domains/dam/types/MediaAware'
import { useUnreleasedFeatures } from '@/domains/system/composables/useUnreleasedFeatures'
import { useDebugFeatures } from '@/domains/system/composables/useDebugFeatures'
import { useSentry } from '@/domains/system/composables/sentry'
import { useUserActivity } from '@/domains/system/composables/useUserActivity'
import { useSystemBar } from '@/domains/system/systemBar/composables/systemBar'
import { fetchAssetAndCheckForSingleUseByFileIds } from '@/domains/dam/api/damfetchAssetListByFileIdsMultipleLicences'
import {
  fetchAsset,
  fetchAssetAsCmsMedia,
  fetchAssetByFileId,
  type IdsGroupedByLicences,
} from '@/domains/dam/api/damAssetApi'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import {
  type UploadMetadataToImageMapFn,
  type UploadMetadataToImageMapItem,
  type AssetSelectMetadataToImageMapFn,
} from '@/domains/dam/imageWidget/utils/metadataToImageMap'

import AFilterBooleanSelect from '@/domains/filters/components/AFilterBooleanSelect.vue'
import AFilterInteger from '@/domains/filters/components/AFilterInteger.vue'
import AFilterRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFilterRemoteAutocomplete.vue'
import AFormRemoteAutocomplete from '@/domains/remoteAutocomplete/components/AFormRemoteAutocomplete.vue'
import {
  createFilterRemoteAutocomplete,
  type CreateRemoteAutocompleteOptions,
  type RemoteAutocompleteScope,
  createRemoteAutocomplete,
  type FilterRemoteAutocompleteComponent,
  type FilterRemoteAutocompleteProps,
  type RemoteAutocompleteComponent,
  type RemoteAutocompleteProps,
  type RemoteInnerFilter,
  type RemoteSelectActions,
} from '@/domains/remoteAutocomplete/composables/createRemoteAutocomplete'
import AFormRemoteAutocompleteWithCached from '@/domains/remoteAutocomplete/components/AFormRemoteAutocompleteWithCached.vue'
import AFilterString from '@/domains/filters/components/AFilterString.vue'
import AFilterTimeInterval from '@/domains/filters/components/AFilterTimeInterval.vue'
import AFilterValueObjectOptionsSelect from '@/domains/filters/components/AFilterValueObjectOptionsSelect.vue'
import AFilterWrapper from '@/domains/filters/components/AFilterWrapper.vue'
import AFilterWrapperSidebar from '@/domains/filters/components/AFilterWrapperSidebar.vue'
import AFilterWrapperSubjectSelect from '@/domains/subjectSelect/components/AFilterWrapperSubjectSelect.vue'
import AFiltersSelected from '@/domains/filters/components/FiltersSelected.vue'
import ADatatableOrdering from '@/domains/filters/datatable/components/ADatatableOrdering.vue'
import ADatatablePagination from '@/domains/filters/datatable/components/ADatatablePagination.vue'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { useApiFetchItems } from '@/domains/api/composables/useApiFetchItems'
import type {
  FetchItemsParams,
  ItemsShape,
  UseApiFetchItemsParams,
  UseApiFetchItemsReturnType,
} from '@/domains/api/composables/useApiFetchItems'
import type {
  FetchByIdsParams,
  UseApiFetchByIdsParams,
  UseApiFetchByIdsReturnType,
} from '@/domains/api/composables/useApiFetchByIds'
import { useApiCommand, useApiRequest } from '@/domains/api/composables/useApiRequest'
import {
  type ApiClientSetup,
  type ApiClientRequestInterceptor,
  type ApiClientResponseInterceptor,
  defineApiClient,
  skipUrlPrefixes,
} from '@/domains/api/composables/defineApiClient'
import { startWithEnvConfig } from '@/shared/utils/envConfig'
import { checkForNewVersion, RELOAD_VETO_GRACE, requestAppReload } from '@/domains/system/systemBar/utils/appReload'
import type {
  ExecuteRequestParams,
  UseApiRequestParams,
  UseApiRequestReturnType,
} from '@/domains/api/composables/useApiRequest'
import { apiErrorStatus, defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import type { ApiErrorContext } from '@/domains/api/utils/apiErrors'
import type { ApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { useApiFetchListBatch } from '@/domains/api/composables/useApiFetchListBatch'
import type {
  FetchListBatchParams,
  UseApiFetchListBatchParams,
  UseApiFetchListBatchReturnType,
} from '@/domains/api/composables/useApiFetchListBatch'
import { useApiQueryBuilder } from '@/domains/api/composables/useApiQueryBuilder'
import { generateListQuery, useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import type {
  FetchListParams,
  UseApiFetchListParams,
  UseApiFetchListReturnType,
} from '@/domains/api/composables/useApiFetchList'
import { useJobApi } from '@/domains/job/api/jobApi'
import ALogListView from '@/domains/log/components/ALogListView.vue'
import ALogDetailView from '@/domains/log/components/ALogDetailView.vue'
import {
  DEFAULT_LOG_PATHS,
  isLogType,
  LogType,
  LogTypeDefault,
  type LogPaths,
  type LogTypeType,
} from '@/domains/log/composables/logType'
import { type LogTimeWindow } from '@/domains/log/filter/logFilter'
import {
  DatatablePaginationKey,
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
} from '@/domains/filters/utils/filterInjectionKeys'
import {
  buildFilterHash,
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  isRouterSafeHash,
  type FilterStoreIdentifier,
  type MakeFilterOption,
  useFilterHelpers,
  type AllowedFilterValues,
  type FilterField,
  type FilterType,
  type FilterVariant,
} from '@/domains/filters/composables/filterFactory'
import {
  TimeIntervalSpecialOptions,
  type TimeIntervalSpecialOptionsType,
  type TimeIntervalToolsValue,
} from '@/domains/filters/composables/filterTimeIntervalTools'
import { type Pagination, usePagination } from '@/domains/api/composables/pagination'
import { createDatatableColumnsConfig } from '@/domains/filters/datatable/composables/createDatatableColumnsConfig'
import { useSubjectSelect } from '@/domains/subjectSelect/composables/useSubjectSelect'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import ASubjectSelect from '@/domains/subjectSelect/components/ASubjectSelect.vue'
import AListEditor from '@/domains/listEditor/components/AListEditor.vue'
import ASortableListEditor from '@/domains/listEditor/components/ASortableListEditor.vue'
import ANestedSortableListEditor from '@/domains/listEditor/components/ANestedSortableListEditor.vue'
import AUnsavedConfirmDialog from '@/domains/unsavedGuard/components/AUnsavedConfirmDialog.vue'
import { useUnsavedChangesGuard } from '@/domains/unsavedGuard/composables/useUnsavedChangesGuard'
import {
  useUnsavedSection,
  type UnsavedSectionDescriptor,
  type UnsavedSectionSource,
} from '@/domains/unsavedGuard/composables/useUnsavedSection'
import {
  useListEditorController,
  type ListEditorHandle,
  type ExposedListEditorHandle,
  type UseListEditorControllerOptions,
  type ListEditorChanges,
  type ListEditorValidationResult,
  type GetKey,
  type PositionOption,
  type PositionStrategy,
  type PositionAction,
} from '@/domains/listEditor/composables/useListEditorController'
import {
  renumberPositions,
  sortByPosition,
  sortByPositionDeep,
  type RenumberPositionsOptions,
} from '@/domains/listEditor/utils/positions'
import { nextListEditorTempId } from '@/domains/listEditor/utils/tempId'
import { type NestedViewItem } from '@/domains/listEditor/composables/useNestedListEditor'
import {
  useNestedListEditorController,
  type NestedListEditorHandle,
  type ExposedNestedListEditorHandle,
  type ExposedNestedSortableListEditorHandle,
  type NestedSortableListEditorExtras,
  type UseNestedListEditorControllerOptions,
  type NestedListEditorChanges,
} from '@/domains/listEditor/composables/useNestedListEditorController'
import type {
  ListEditorKey,
  ListEditorValidationState,
  ListViewItem,
  NestedPositionHint,
  NestedTree,
  NestedTreeNode,
  PositionHint,
} from '@/domains/listEditor/types/listEditorTypes'
import { useUserAdminConfigApi } from '@/domains/filters/bookmarks/api/userAdminConfigApi'
import { useUserAdminConfigFactory } from '@/domains/filters/bookmarks/factory/UserAdminConfigFactory'
import {
  type UserAdminConfig,
  type UserAdminConfigDataFilterBookmark,
  type UserAdminConfigDataPinnedWidgets,
  UserAdminConfigLayoutType,
  type UserAdminConfigLayoutTypeType,
  UserAdminConfigType,
  type UserAdminConfigTypeType,
} from '@/domains/filters/bookmarks/types/UserAdminConfig'

import APermissionGroupDatatable from '@/domains/permission/group/components/APermissionGroupDatatable.vue'
import APermissionGroupDetail from '@/domains/permission/group/components/APermissionGroupDetail.vue'
import APermissionGroupManage from '@/domains/permission/group/components/APermissionGroupManage.vue'
import {
  usePermissionGroupActions,
  type PermissionGroupActionsParams,
} from '@/domains/permission/group/composables/permissionGroupActions'

import AAnzuUserDatatable from '@/domains/anzuUser/components/AAnzuUserDatatable.vue'
import AAnzuUserForm from '@/domains/anzuUser/components/AAnzuUserForm.vue'
import AUserCopyPermissionsDialog from '@/domains/anzuUser/components/AUserCopyPermissionsDialog.vue'
import { useAnzuUserActions } from '@/domains/anzuUser/composables/anzuUserActions'
import { type AnzuUserActionsParams } from '@/domains/anzuUser/composables/anzuUserActions'
import {
  defineUserSystemDescriptor,
  resolveCreateEndpoint,
  resolveEnabledWrite,
  resolveMetadataWrite,
  resolveProbeEndpoint,
  type AnyUserSystemDescriptor,
  type AnzuUserEndpointPair,
  type BaseUserEndpointPair,
  type UserSystemDescriptor,
  type UserSystemEndpoints,
  type UserSystemExtraState,
  type UserSystemManageTarget,
} from '@/domains/anzuUser/composables/userSystemDescriptor'

import AUserTabsShell from '@/domains/anzuUser/components/AUserTabsShell.vue'
import { OTHER_SYSTEMS_TAB } from '@/domains/anzuUser/utils/userTabs'
import { USER_PROBE_ENTITY, type UserSystemRefreshHook } from '@/domains/anzuUser/composables/userSystemProbe'

import AUserSystemOverview from '@/domains/anzuUser/components/AUserSystemOverview.vue'

export {
  // COMPONENTS
  ACard,
  AProgress,
  ARow,
  AChipNoLink,
  AAlerts,
  AActionbar,
  AActionbarTarget,
  ALayoutLoader,
  ALayoutSwitch,
  actionbarSlot,
  createTeleportSlot,
  type TeleportSlot,
  ABooleanValue,
  ASystemEntityScope,
  AFormTextField,
  AFormTextarea,
  AFormDatetimePicker,
  AFormFlagDatetimePicker,
  AFormRemoteCheckbox,
  AFormRemoteSwitch,
  AFormSwitch,
  AFormValueObjectOptionsSelect,
  ADatetime,
  ADatetimePicker,
  ADatatableConfigButton,
  ADialogToolbar,
  ACreateDialog,
  AJobStatusChip,
  ACachedChip,
  AAdminSwitcher,
  ATimeTrackingFields,
  Acl,
  ACopyText,
  AIconGroup,
  AUserAndTimeTrackingFields,
  AActionCloseButtonHistory,
  AActionCreateButton,
  AActionDeleteButton,
  AActionEditButton,
  AActionSaveAndCloseButton,
  AActionSaveButton,
  ATableCopyIdButton,
  ATableDetailButton,
  ATableEditButton,
  ABtnSplit,
  AThemeSelect,
  ALanguageSelect,
  ASystemBar,
  AAnzuUserAvatar,
  AAvatarColorPicker,
  ACurrentUserDropdown,
  AJobDetailCommon,
  AJobPriorityChip,
  AJobBaseCreateForm,
  ACustomDataForm,
  ACustomDataFormElement,
  AImageWidget,
  AImageWidgetInner,
  AImageMediaWidget,
  AImageWidgetSimple,
  AMediaWidgetSimple,
  AImageWidgetMultiple,
  AImageWidgetMultipleInner,
  AImageWidgetMultipleSimple,
  AImageMassOperations,
  AImagePublicInput,
  ADamAssetImageRoiSelect,
  ACollabLockedByUser,
  ACollabManagement,
  AFileInput,
  AAssetSelect,
  AAssetListInner,
  ABooleanSelect,
  ADamExtSystemRemoteAutocomplete,
  ADamExternalProviderAssetSelect,
  ADamDistributionServiceSelect,
  ADamAssetLicenceRemoteAutocomplete,
  ADamAssetLicenceGroupRemoteAutocomplete,
  ADamAuthorFilterRemoteAutocomplete,
  ADamKeywordFilterRemoteAutocomplete,
  ADamUserFilterRemoteAutocomplete,
  ADamUserRemoteAutocomplete,
  ADamAdminAssetLink,

  // VIEWS
  ALoginView,
  ALogoutView,
  AUnauthorizedView,
  ANotFoundView,
  AGenericView,

  // COMPOSABLES
  useRouteHistory,
  type NavigateBackOptions,
  type RouteHistoryEntry,
  useRemainingTime,
  useAlerts,
  useTheme,
  defineCached,
  Theme,
  type ThemeType,
  useLanguageSettings,
  modifyLanguageSettings,
  useLoginStatus,
  generateDatatableMinMaxSelectStrategy,
  useCustomDataFormElementType,
  useDamConfigState,
  useUploadQueueItemFactory,
  useDamUploadChunkSize,
  useDamAcceptTypeAndSizeHelper,
  useAssetSuggestions,
  destroyDamNotifications,
  initDamNotifications,
  useDamNotifications,
  useDropzoneGlobalDragState,
  useDamKeywordFactory,
  useDamAuthorFactory,
  useDamAuthorType,
  useDamDistributionServiceType,
  useDamAssetLicenceInnerFilter,
  useImageActions,
  useCommonAdminImageOptions,
  defineAuth,
  AuthUnavailableError,
  type AuthCookieState,
  createRefreshRequestInterceptor,
  createRefreshSession,
  isInCauseChain,
  type RefreshResult,
  SessionExpiredError,
  defineBreadcrumbs,
  useDamCachedUsers,
  useUnreleasedFeatures,
  useDebugFeatures,
  useSentry,
  useUserActivity,

  // VALUE OBJECTS
  type GrantType,
  Grant,
  useGrant,
  type GrantOriginType,
  GrantOrigin,
  GrantOriginDefault,
  useGrantOrigin,
  LogLevel,
  type LogLevelType,

  // TYPES
  type IntegerId,
  type IntegerIdNullable,
  type DocId,
  type DocIdNullable,
  type DatetimeUTCNullable,
  type DatetimeUTC,
  type DateUTC,
  type DatetimePickerType,
  type AnzuUser,
  type BaseUser,
  type AnzuUserMinimal,
  type AnzuUserAndTimeTrackingAware,
  type ValueObjectOption,
  type CreatedByAware,
  type PermissionConfig,
  type PermissionTranslationGroup,
  type PermissionGroup,
  type PermissionGroupMinimal,
  type VuetifyIconValue,
  type JobBase,
  type JobUserDataDelete,
  JOB_RESOURCE_USER_DATA_DELETE,
  JobStatus,
  JobStatusDefault,
  type JobStatusType,
  type JobBaseResource,
  useCommonJobFactory,
  type AclValue,
  type AclRegistry,
  type AclValueOf,
  type RegisteredAclValue,
  type Permissions,
  type PluginOptions,
  type CommonAdminImageOptions,
  type CommonAdminCoreDamOptions,
  type CommonAdminCollabOptions,
  type LanguageCode,
  type Immutable,
  type ResourceNameSystemAware,
  type ValidationScope,
  type AFormFieldValidation,
  type CommonAdminGlobalComponents,
  type ACreateDialogValidation,
  type Log,
  type ApiInfiniteResponseList,
  type DatatableOrderingOption,
  type DatatableOrderingOptions,
  type DatatableSortBy,
  type SortOrderType,
  type ObjectLeaves,
  type UniqueValues,
  ensureUniqueValues,
  type CachedItem,
  type RecordWasType,
  type UrlParams,
  type AssetSelectReturnData,
  AssetSelectReturnType,
  type AssetSelectReturnTypeType,
  type SortableItemDataAware,
  type AssetFileProperties,
  type AssetSearchListItemDto,
  type AssetDetailItemDto,
  type AssetMetadataDto,
  type AssetCustomData,
  type AssetMetadataSuggestions,
  AssetFileFailReason,
  type AssetFileFailReasonType,
  AssetFileProcessStatus,
  type AssetFileProcessStatusType,
  AssetFileLinkType,
  type AssetFileLinkTypeType,
  type AssetFile,
  type AssetFileDocument,
  type AssetFileVideo,
  type AssetFileAudio,
  type AssetFileImage,
  type AssetFileNullable,
  type AssetFileLink,
  type AssetFileLinks,
  type AssetFileRoute,
  AssetFileRouteStatus,
  type AssetFileRouteStatusType,
  type AssetFileMainRouteAware,
  type AssetFileDownloadLink,
  type AssetFileImagePreviewNullable,
  assetFileIsImageFile,
  assetFileIsVideoFile,
  assetFileIsAudioFile,
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  UploadQueueItemType,
  type UploadQueueItemTypeType,
  type CustomDataAware,
  type CustomDataValue,
  type CustomDataFormElement,
  type CustomDataFormElementAttributes,
  CustomDataFormElementType,
  CustomDataFormElementTypeDefault,
  type CustomDataFormElementTypeType,
  DamAssetType,
  DamAssetTypeDefault,
  type DamAssetTypeType,
  DamAssetStatus,
  DamAssetStatusDefault,
  type DamAssetStatusType,
  type DamPubConfig,
  type DamPrvConfig,
  type DamExtSystemConfig,
  type DamDistributionServiceName,
  type DamExtSystemConfigItem,
  type DamExtSystemConfigItemImage,
  type DamExternalProviderAssetConfig,
  type DamExternalProviderAssetName,
  type DamDistributionConfig,
  type DamDistributionRequirementsConfig,
  DamDistributionRequirementStrategy,
  type DamDistributionRequirementStrategyType,
  type DamDistributionRequirementsCategorySelectConfig,
  type DamExtSystemAssetTypeExifMetadata,
  DamDistributionServiceType,
  type DamDistributionServiceTypeType,
  DamDistributionStatus,
  type DamDistributionStatusType,
  UserAuthType,
  type UserAuthTypeType,
  type DamUploadStartResponse,
  type DamNotificationNameType,
  DamNotificationName,
  type ImageAware,
  type ImageCreateUpdateAware,
  type ImageCreateUpdateAwareKeyed,
  type UploadMetadataToImageMapFn,
  type UploadMetadataToImageMapItem,
  type AssetSelectMetadataToImageMapFn,
  isImageCreateUpdateAware,
  type ImageMediaCollabValue,
  type MediaAware,
  isMediaAware,
  type DamMediaFromDam,
  type DamMedia,
  DamMediaType,
  type DamMediaTypeType,
  type DamAuthor,
  type DamAuthorMinimal,
  type DamKeyword,
  type DamKeywordMinimal,
  DamAuthorType,
  type DamAuthorTypeType,
  type DamExtSystem,
  type DamExtSystemMinimal,
  type DamCurrentUserDto,
  type DamAssetLicence,
  type DamAssetLicenceMinimal,
  type DamAssetLicenceGroup,
  type DamUserUpdateDto,
  type DamUser,
  type BreadcrumbItem,
  type Breadcrumbs,
  type UploadQueueKey,
  type DamConfigLicenceExtSystemReturnType,

  // FACTORIES
  useAnzuUserFactory,
  usePermissionConfigFactory,
  usePermissionGroupFactory,

  // UTILS
  // common
  cloneDeep,
  isEmpty,
  isEmptyObject,
  isObject,
  isArray,
  isFunction,
  isBoolean,
  isDocId,
  isNull,
  isUndefined,
  isDefined,
  isInt,
  isString,
  isNumber,
  // object
  objectGetValueByPath,
  objectSetValueByPath,
  objectDeletePropertyByPath,
  objectDeepFreeze,
  // string
  stringToInt,
  stringToFloat,
  stringToSlug,
  stringSplitOnFirstOccurrence,
  stringToKebabCase,
  stringIsValidEmail,
  stringToBooleanExact,
  // datetime
  DATETIME_MIN,
  DATETIME_MAX,
  dateTimeEndOfDay,
  dateTimeStartOfDay,
  dateTimeNow,
  dateTimeFriendly,
  dateTimePretty,
  dateModifyMinutes,
  dateToUtc,
  dateNow,
  dateTimeToDate,
  datePretty,
  dateUtcPretty,
  dateUtcToday,
  timePretty,
  dateDiff,
  type DateDiffUnit,
  // file
  prettyBytes,
  prettyDuration,
  // response
  // number
  // boolean
  booleanToInteger,
  // array
  arrayItemToggle,
  arrayFromArgs,
  arrayFlatten,
  type NestedArray,
  arraysHaveSameElements,
  // history
  browserHistoryReplaceUrlByRouter,
  // event
  eventClickBlur,
  // generator
  generateUUIDv1,
  generateUUIDv4,
  // enum
  isOneOf,

  // SERVICES
  useJobBaseResource,
  useJobStatus,
  fetchDamAssetLicenceListByIds,
  useFetchDamAssetLicenceList,
  fetchDamAssetLicenceGroupListByIds,
  fetchDamExtSystemListByIds,
  fetchDamUserListByIds,
  useFetchDamUserList,
  updateDamUser,
  fetchDamUser,
  fetchAssetAndCheckForSingleUseByFileIds,
  fetchAsset,
  fetchAssetAsCmsMedia,
  fetchAssetByFileId,
  type IdsGroupedByLicences,

  // TRANSLATIONS
  messagesCs,
  messagesEn,
  messagesSk,

  // SYMBOLS, CONSTANTS
  SystemScopeKey,
  SubjectScopeKey,
  HTTP_STATUS_OK,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_UNPROCESSABLE_ENTITY,
  ROLE_SUPER_ADMIN,
  NEW_LINE_MARK,
  COMMON_CONFIG,
  SORT_BY_SCORE,
  SORT_BY_SCORE_BEST,
  SORT_BY_SCORE_DATE,
  SORT_BY_ID,
  SortOrder,
  ImageWidgetUploadConfigKey,

  // VALIDATIONS
  useValidate,

  // COLLAB
  useCollabInit,
  useCommonAdminCollabOptions,
  useCollabCurrentUserId,
  useCollabState,
  useCollabField,
  useCollabRoom,
  useCollabHelpers,
  useCollabAnyDataChange,
  type CollabGatheringBufferDataEvent,
  useCollabReconnectEventBus,
  useCollabGatheringBufferDataEventBus,
  CollabFieldLockType,
  type CollabFieldLockTypeType,
  CollabFieldLockStatus,
  type CollabFieldLockStatusType,
  type CollabFieldLockStatusPayload,
  type CollabUserId,
  type CollabUserIdNullable,
  type CollabRoom,
  CollabStatus,
  type CollabStatusType,
  type CollabRoomInfo,
  type CollabRoomsInfo,
  type CollabFieldDataEnvelope,
  type CollabFieldData,
  type CollabFieldName,
  type CollabFieldLock,
  type CollabRoomLocks,
  type CollabRoomData,
  type CollabRoomPlainData,
  CollabAccessRoomStatus,
  type CollabAccessRoomStatusType,
  CollabChangeRoomLockStatus,
  type CollabChangeRoomLockStatusType,
  type CollabFieldLockOptions,
  CollabRoomJoinStrategy,
  type CollabRoomJoinStrategyType,
  type CollabRoomOptions,
  CollabRequestToTakeModerationStatus,
  type CollabRequestToTakeModerationStatusType,
  CollabRequestToJoinStatus,
  type CollabRequestToJoinStatusType,
  type CollabCachedUsersMap,
  type CollabComponentConfig,
  COLLAB_FIELD_PREFIX_COMMENT,
  COLLAB_FIELD_PREFIX_EMBED,

  //  STORES
  useDamConfigStore,
  useImageStore,

  // OTHER
  type CommonAdminI18n,
  slovakPluralizationRule,
  isAnzuApiForbiddenError,
  axiosErrorResponseIsForbidden,
  AnzuApiForbiddenError,
  isAnzuApiResponseCodeError,
  AnzuApiResponseCodeError,
  isAnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
  AnzuApiForbiddenOperationError,
  isAnzuApiValidationError,
  hasAnzuApiValidationErrorSpecific,
  axiosErrorResponseHasValidationData,
  AnzuApiValidationError,
  isAnzuFatalError,
  AnzuFatalError,
  isAnzuApiTimeoutError,
  AnzuApiTimeoutError,
  AnzuApiCancelledError,
  isAnzuApiCancelledError,
  AnzuError,
  isAnzuError,
  isAnzuApiAxiosError,
  AnzuApiAxiosError,
  type ValidationError,
  type AnzuApiValidationResponseData,
  isAnzuApiDependencyExistsError,
  axiosErrorResponseHasDependencyExistsData,
  AnzuApiDependencyExistsError,
  AnzuSystemsCommonAdmin,
  useCommonVuetifyConfig,
  createAnzuVuetify,
  type CreateAnzuVuetifyOptions,
  loadCommonFonts,
  getAssetTypeByMimeType,
  damFileTypeFix,
  localTimeShiftInSeconds,
  useSystemBar,
  // V2 FILTERS
  AFilterWrapper,
  AFilterWrapperSidebar,
  AFilterWrapperSubjectSelect,
  AFiltersSelected,
  AFilterBooleanSelect,
  AFilterInteger,
  AFilterRemoteAutocomplete,
  AFilterString,
  AFilterTimeInterval,
  AFilterValueObjectOptionsSelect,
  FilterConfigKey,
  FilterDataKey,
  FilterInnerConfigKey,
  FilterInnerDataKey,
  ADatatableOrdering,
  ADatatablePagination,
  DatatablePaginationKey,
  AFormRemoteAutocomplete,
  createFilterRemoteAutocomplete,
  createRemoteAutocomplete,
  type CreateRemoteAutocompleteOptions,
  type RemoteAutocompleteScope,
  type FilterRemoteAutocompleteComponent,
  type FilterRemoteAutocompleteProps,
  type RemoteAutocompleteComponent,
  type RemoteAutocompleteProps,
  type RemoteInnerFilter,
  type RemoteSelectActions,
  AFormRemoteAutocompleteWithCached,
  buildFilterHash,
  createFilter,
  createFilterStore,
  isRouterSafeHash,
  useFilterHelpers,
  type FilterConfig,
  type FilterData,
  type FilterStoreIdentifier,
  type MakeFilterOption,
  type AllowedFilterValues,
  type FilterField,
  type FilterType,
  type FilterVariant,
  TimeIntervalSpecialOptions,
  type TimeIntervalToolsValue,
  type TimeIntervalSpecialOptionsType,
  type Pagination,
  useApiFetchByIds,
  useApiFetchItems,
  useApiFetchList,
  useApiCommand,
  useApiRequest,
  defineApiClient,
  startWithEnvConfig,
  checkForNewVersion,
  requestAppReload,
  RELOAD_VETO_GRACE,
  skipUrlPrefixes,
  type ApiClientSetup,
  type ApiClientRequestInterceptor,
  type ApiClientResponseInterceptor,
  // A wrapper around a helper has to be able to name what it returns and what it takes. Without
  // these the fleet can call the family but cannot write a function that hands one on, which is the
  // shape the admins are being moved towards.
  type UseApiRequestParams,
  type ExecuteRequestParams,
  type UseApiRequestReturnType,
  type UseApiFetchListParams,
  type FetchListParams,
  type UseApiFetchListReturnType,
  type UseApiFetchByIdsParams,
  type FetchByIdsParams,
  type UseApiFetchByIdsReturnType,
  type UseApiFetchItemsParams,
  type FetchItemsParams,
  type ItemsShape,
  type UseApiFetchItemsReturnType,
  type UseApiFetchListBatchParams,
  type FetchListBatchParams,
  type UseApiFetchListBatchReturnType,
  defaultApiErrorLogger,
  apiErrorStatus,
  setApiErrorLogger,
  type ApiErrorContext,
  type ApiErrorLogger,
  useApiFetchListBatch,
  useApiQueryBuilder,
  generateListQuery,
  usePagination,
  createDatatableColumnsConfig,
  useSubjectSelect,
  ASubjectSelect,
  AListEditor,
  ASortableListEditor,
  ANestedSortableListEditor,
  AUnsavedConfirmDialog,
  useUnsavedChangesGuard,
  useUnsavedSection,
  type UnsavedSectionDescriptor,
  type UnsavedSectionSource,
  useListEditorController,
  type ListEditorHandle,
  type ExposedListEditorHandle,
  type UseListEditorControllerOptions,
  type ListEditorChanges,
  type ListEditorValidationResult,
  type GetKey,
  type PositionOption,
  type PositionStrategy,
  type PositionAction,
  renumberPositions,
  sortByPosition,
  sortByPositionDeep,
  type RenumberPositionsOptions,
  nextListEditorTempId,
  type NestedViewItem,
  useNestedListEditorController,
  type NestedListEditorHandle,
  type ExposedNestedListEditorHandle,
  type ExposedNestedSortableListEditorHandle,
  type NestedSortableListEditorExtras,
  type UseNestedListEditorControllerOptions,
  type NestedListEditorChanges,
  type ListEditorKey,
  type ListEditorValidationState,
  type ListViewItem,
  type NestedPositionHint,
  type NestedTree,
  type NestedTreeNode,
  type PositionHint,
  useJobApi,
  type AxiosClientFn,
  useUserAdminConfigApi,
  type UserAdminConfig,
  UserAdminConfigType,
  type UserAdminConfigTypeType,
  UserAdminConfigLayoutType,
  type UserAdminConfigLayoutTypeType,
  type UserAdminConfigDataFilterBookmark,
  type UserAdminConfigDataPinnedWidgets,
  useUserAdminConfigFactory,
  ALogListView,
  ALogDetailView,
  LogType,
  LogTypeDefault,
  type LogTypeType,
  isLogType,
  DEFAULT_LOG_PATHS,
  type LogPaths,
  type LogTimeWindow,
  // PERMISSIONS / PERMISSION GROUPS
  APermissionGroupDatatable,
  APermissionGroupDetail,
  APermissionGroupManage,
  usePermissionGroupActions,
  type PermissionGroupActionsParams,
  // ANZU USER
  AAnzuUserDatatable,
  AAnzuUserForm,
  AUserCopyPermissionsDialog,
  useAnzuUserActions,
  type AnzuUserActionsParams,
  defineUserSystemDescriptor,
  resolveProbeEndpoint,
  resolveMetadataWrite,
  resolveEnabledWrite,
  resolveCreateEndpoint,
  type UserSystemDescriptor,
  type AnyUserSystemDescriptor,
  type UserSystemEndpoints,
  type AnzuUserEndpointPair,
  type BaseUserEndpointPair,
  type UserSystemExtraState,
  type UserSystemManageTarget,
  // CROSS-SYSTEM USER VIEW
  AUserTabsShell,
  OTHER_SYSTEMS_TAB,
  USER_PROBE_ENTITY,
  type UserSystemRefreshHook,
  AUserSystemOverview,
}

export { createCachedChip } from '@/domains/cached/composables/createCachedChip'
export type { CreateCachedChipOptions } from '@/domains/cached/composables/createCachedChip'
