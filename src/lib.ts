import ABooleanValue from '@/components/ABooleanValue.vue'
import ARow from '@/components/ARow.vue'
import AAlerts from '@/components/AAlerts.vue'
import ACard from '@/components/ACard.vue'
import ACardLoader from '@/components/ACardLoader.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import ADatatablePagination from '@/components/ADatatablePagination.vue'
import ADatatableConfigButton from '@/components/ADatatableConfigButton.vue'
import ADatatableOrdering from '@/components/ADatatableOrdering.vue'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import ALogData from '@/components/ALogData.vue'
import ACreateDialog from '@/components/ACreateDialog.vue'
import AAdminSwitcher from '@/components/AAdminSwitcher.vue'
import AEmptyRouterView from '@/components/AEmptyRouterView.vue'
import ATimeTrackingFields from '@/components/ATimeTrackingFields.vue'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterMixed from '@/components/filter/AFilterMixed.vue'
import AFilterInteger from '@/components/filter/AFilterInteger.vue'
import AFilterWrapper from '@/components/filter/AFilterWrapper.vue'
import APermissionGrantEditor from '@/components/permission/APermissionGrantEditor.vue'
import APermissionValueChip from '@/components/permission/APermissionValueChip.vue'
import Acl from '@/components/permission/Acl.vue'
import ADatetime from '@/components/datetime/ADatetime.vue'
import ADatetimePicker from '@/components/datetime/ADatetimePicker.vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'
import AFormFlagDatetimePicker from '@/components/form/AFormFlagDatetimePicker.vue'
import AFilterDatetimePicker from '@/components/filter/AFilterDatetimePicker.vue'
import AFormRemoteAutocomplete from '@/components/form/AFormRemoteAutocomplete.vue'
import AFormRemoteCheckbox from '@/components/form/AFormRemoteCheckbox.vue'
import AFormSwitch from '@/components/form/AFormSwitch.vue'
import AFormRemoteSwitch from '@/components/form/AFormRemoteSwitch.vue'
import AFormValueObjectOptionsSelect from '@/components/form/AFormValueObjectOptionsSelect.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter/AFilterValueObjectOptionsSelect.vue'
import AFilterRemoteAutocomplete from '@/components/filter/AFilterRemoteAutocomplete.vue'
import AFilterBooleanGroup from '@/components/filter/AFilterBooleanGroup.vue'
import AFilterBooleanSelect from '@/components/filter/AFilterBooleanSelect.vue'
import AJobStatusChip from '@/components/job/AJobStatusChip.vue'
import ACachedChip from '@/components/ACachedChip.vue'
import ALogLevelChip from '@/components/log/ALogLevelChip.vue'
import ACopyText from '@/components/ACopyText.vue'
import AIconGroup from '@/components/AIconGroup.vue'
import AChipNoLink from '@/components/AChipNoLink.vue'
import ACollabLockedByUser from '@/components/collab/components/ACollabLockedByUser.vue'
import ACollabCountdown from '@/components/collab/components/ACollabCountdown.vue'
import ACollabManagement from '@/components/collab/components/ACollabManagement.vue'
import AUserAndTimeTrackingFields from '@/components/AUserAndTimeTrackingFields.vue'
import AActionCloseButton from '@/components/buttons/action/AActionCloseButton.vue'
import AActionCreateButton from '@/components/buttons/action/AActionCreateButton.vue'
import AActionDeleteButton from '@/components/buttons/action/AActionDeleteButton.vue'
import AActionEditButton from '@/components/buttons/action/AActionEditButton.vue'
import AActionSaveAndCloseButton from '@/components/buttons/action/AActionSaveAndCloseButton.vue'
import AActionSaveButton from '@/components/buttons/action/AActionSaveButton.vue'
import AFilterAdvancedButton from '@/components/buttons/filter/AFilterAdvancedButton.vue'
import AFilterResetButton from '@/components/buttons/filter/AFilterResetButton.vue'
import AFilterSubmitButton from '@/components/buttons/filter/AFilterSubmitButton.vue'
import ATableCopyIdButton from '@/components/buttons/table/ATableCopyIdButton.vue'
import ATableDetailButton from '@/components/buttons/table/ATableDetailButton.vue'
import ATableEditButton from '@/components/buttons/table/ATableEditButton.vue'
import ABtnSplit from '@/components/buttons/ABtnSplit.vue'
import AThemeSelect from '@/components/AThemeSelect.vue'
import ALanguageSelect from '@/components/ALanguageSelect.vue'
import ASystemBar from '@/components/systemBar/ASystemBar.vue'
import AAnzuUserAvatar from '@/components/AAnzuUserAvatar.vue'
import AAvatarColorPicker from '@/components/AAvatarColorPicker.vue'
import ACurrentUserDropdown from '@/components/ACurrentUserDropdown.vue'
import AFormRemoteAutocompleteWithCached from '@/components/form/AFormRemoteAutocompleteWithCached.vue'
import ALoginView from '@/components/view/ALoginView.vue'
import ALogoutView from '@/components/view/ALogoutView.vue'
import AUnauthorizedView from '@/components/view/AUnauthorizedView.vue'
import ANotFoundView from '@/components/view/ANotFoundView.vue'
import AJobDetailCommon from '@/components/job/AJobDetailCommon.vue'
import AJobPriorityChip from '@/components/job/AJobPriorityChip.vue'
import AJobBaseCreateForm from '@/components/job/AJobBaseCreateForm.vue'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import ASortable from '@/components/sortable/ASortable.vue'
import ASortableNested from '@/components/sortable/ASortableNested.vue'
import ASubjectSelect from '@/components/subjectSelect/ASubjectSelect.vue'
import ACustomDataForm from '@/components/customDataForm/ACustomDataForm.vue'
import ACustomDataFormElement from '@/components/customDataForm/ACustomDataFormElement.vue'
import AImageWidget from '@/components/damImage/AImageWidget.vue'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import AImageWidgetMultiple from '@/components/damImage/AImageWidgetMultiple.vue'
import AImageWidgetMultipleSimple from '@/components/damImage/AImageWidgetMultipleSimple.vue'
import AImagePublicInput from '@/components/damImage/AImagePublicInput.vue'
import ACropperjs from '@/components/ACropperjs.vue'
import ADatatable from '@/components/datatable/ADatatable.vue'
import ABooleanSelect from '@/components/ABooleanSelect.vue'
import { useSubjectSelect } from '@/components/subjectSelect/useSubjectSelect'
import { useCustomDataForm } from '@/components/customDataForm/useCustomDataForm'
import {
  CustomDataFormElementType,
  CustomDataFormElementTypeDefault,
  type CustomDataFormElementTypeType,
  useCustomDataFormElementType,
} from '@/components/customDataForm/CustomDataFormElementTypes'
import { generateDatatableMinMaxSelectStrategy } from '@/components/subjectSelect/selectStrategies'
import { i18n } from '@/plugins/i18n'
import {
  type Immutable,
  objectDeepFreeze,
  objectDeletePropertyByPath,
  objectGetValueByPath,
  objectGetValues,
  objectSetValueByPath,
} from '@/utils/object'
import { numberToString } from '@/utils/number'
import {
  cloneDeep,
  isArray,
  isBoolean,
  isDefined,
  isDocId,
  isEmpty,
  isEmptyArray,
  isEmptyObject,
  isFunction,
  isInt,
  isNull,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from '@/utils/common'
import {
  stringIsValidEmail,
  stringNormalizeForSlotName,
  stringSplitOnFirstOccurrence,
  stringToFloat,
  stringToInt,
  stringToKebabCase,
  stringToSlug,
  stringTrimLength,
  stringUrlTemplateReplace,
  stringUrlTemplateReplaceVueRouter,
} from '@/utils/string'
import { booleanToInteger } from '@/utils/boolean'
import {
  dateDiff,
  dateModifyMinutes,
  dateNow,
  datePretty,
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
  timestampCurrent,
  yearNow,
} from '@/utils/datetime'
import { Grant, useGrant } from '@/model/valueObject/Grant'
import { GrantOrigin, useGrantOrigin } from '@/model/valueObject/GrantOrigin'
import { useAnzuUserFactory } from '@/model/factory/AnzuUserFactory'
import { usePermissionConfigFactory } from '@/model/factory/PermissionConfigFactory'
import { usePermissionGroupFactory } from '@/model/factory/PermissionGroupFactory'
import type {
  DatetimeUTC,
  DatetimeUTCNullable,
  DocId,
  DocIdNullable,
  EnableDisable,
  IntegerId,
  IntegerIdNullable,
} from '@/types/common'
import type { Filter, FilterBag, FilterVariant } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'
import type { OwnerAware } from '@/types/OwnerAware'
import { isOwnerAware } from '@/types/OwnerAware'
import type { AnzuUser, AnzuUserMinimal } from '@/types/AnzuUser'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { PermissionConfig, PermissionTranslationGroup } from '@/types/PermissionConfig'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { PermissionGroup, PermissionGroupMinimal } from '@/types/PermissionGroup'
import { type CreatedByAware, isCreatedByAware } from '@/types/CreatedByAware'
import type { VuetifyIconValue } from '@/types/Vuetify'
import { usePagination, usePaginationAutoHide } from '@/composables/system/pagination'
import { makeFilterHelper, type MakeFilterOptions, useFilterHelpers } from '@/composables/filter/filterHelpers'
import {
  AvailableLanguagesSymbol,
  DefaultLanguageSymbol,
  SubjectScopeSymbol,
  SystemScopeSymbol,
} from '@/components/injectionKeys'
import { prettyBytes } from '@/utils/file'
import { isValidHTTPStatus } from '@/utils/response'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_UNPROCESSABLE_ENTITY,
} from '@/composables/statusCodes'
import { AnzuApiResponseCodeError, isAnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import {
  AnzuApiValidationError,
  type AnzuApiValidationResponseData,
  axiosErrorResponseHasValidationData,
  isAnzuApiValidationError,
  type ValidationError,
} from '@/model/error/AnzuApiValidationError'
import { AnzuFatalError, isAnzuFatalError } from '@/model/error/AnzuFatalError'
import { apiAnyRequest } from '@/services/api/apiAnyRequest'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiDeleteOne } from '@/services/api/apiDeleteOne'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiFetchList, apiGenerateListQuery } from '@/services/api/apiFetchList'
import { apiFetchListBatch } from '@/services/api/apiFetchListBatch'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { useApiQueryBuilder } from '@/services/api/queryBuilder'
import { NEW_LINE_MARK, type RecordWasType, useAlerts } from '@/composables/system/alerts'
import { useErrors } from '@/composables/system/error'
import { JobStatus, useJobStatus } from '@/model/valueObject/JobStatus'
import type { JobBase, JobUserDataDelete } from '@/types/Job'
import { useJobApi } from '@/services/api/job/jobApi'
import {
  JOB_RESOURCE_USER_DATA_DELETE,
  type JobBaseResource,
  useJobBaseResource,
} from '@/model/valueObject/JobBaseResource'
import { useAcl } from '@/composables/system/ability'
import AnzuSystemsCommonAdmin, {
  type CurrentUserType,
  type CustomAclResolver,
  type PluginOptions,
} from '@/AnzuSystemsCommonAdmin'
import type { AclValue, Permissions } from '@/types/Permission'
import { Theme, useTheme } from '@/composables/themeSettings'
import { type LanguageCode, modifyLanguageSettings, useLanguageSettings } from '@/composables/languageSettings'
import {
  arrayFlatten,
  arrayFromArgs,
  arrayItemToggle,
  arraysHaveSameElements,
  arrayToString,
  type NestedArray,
} from '@/utils/array'
import { browserHistoryReplaceUrlByRouter, browserHistoryReplaceUrlByString } from '@/utils/history'
import { eventClickBlur } from '@/utils/event'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { ValidationScope } from '@/types/Validation'
import { useI18n } from 'vue-i18n'
import messagesCs from '@/locales/cs'
import messagesEn from '@/locales/en'
import messagesSk from '@/locales/sk'
import type { Log } from '@/types/Log'
import { LogLevel, useLogLevel } from '@/model/valueObject/LogLevel'
import '@/styles/main.scss'
import { COMMON_CONFIG } from '@/model/commonConfig'
import { useValidate } from '@/validators/vuelidate/useValidate'
import type { ApiInfiniteResponseList, ApiResponseList } from '@/types/ApiResponse'
import {
  createDatatableColumnsConfig,
  type DatatableOrderingOption,
  type DatatableOrderingOptions,
  type DatatableSortBy,
} from '@/composables/system/datatableColumns'
import { useCommonVuetifyConfig } from '@/model/commonVuetifyConfig'
import { type CachedItem, defineCached } from '@/composables/system/defineCached'
import type { ObjectLeaves, ObjectPaths, Prettify } from '@/types/utils'
import { loadCommonFonts } from '@/plugins/webfontloader'
import {
  AnzuApiForbiddenError,
  axiosErrorResponseIsForbidden,
  isAnzuApiForbiddenError,
} from '@/model/error/AnzuApiForbiddenError'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
  isAnzuApiForbiddenOperationError,
} from '@/model/error/AnzuApiForbiddenOperationError'
import { useCommonJobFactory } from '@/model/factory/JobFactory'
import type { UrlParams } from '@/services/api/apiHelper'
import { generateUUIDv1, generateUUIDv4 } from '@/utils/generator'
import { useLoginStatus } from '@/composables/system/loginStatus'
import { useRemainingTime } from '@/composables/datetime/remainingTime'
import {
  type AssetCustomData,
  type AssetDetailItemDto,
  type AssetFileProperties,
  type AssetMetadataDto,
  type AssetMetadataSuggestions,
  type AssetSearchListItemDto,
  DamAssetStatus,
  DamAssetType,
  type DamDistributionServiceName,
} from '@/types/coreDam/Asset'
import {
  type AssetFile,
  type AssetFileAudio,
  type AssetFileDocument,
  type AssetFileDownloadLink,
  AssetFileFailReason,
  type AssetFileImage,
  type AssetFileImagePreviewNullable,
  assetFileIsAudioFile,
  assetFileIsDocumentFile,
  assetFileIsImageFile,
  assetFileIsVideoFile,
  type AssetFileLink,
  type AssetFileLinks,
  AssetFileLinkType,
  type AssetFileMainRouteAware,
  type AssetFileNullable,
  AssetFileProcessStatus,
  type AssetFileRoute,
  type AssetFileRouteStatus,
  type AssetFileVideo,
} from '@/types/coreDam/AssetFile'
import {
  type DamUploadStartResponse,
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
} from '@/types/coreDam/UploadQueue'
import type {
  CustomDataAware,
  CustomDataFormElement,
  CustomDataFormElementAttributes,
} from '@/components/customDataForm/CustomDataForm'
import type { AssetSelectReturnData } from '@/types/coreDam/AssetSelect'
import type { SortableItem, SortablePropItem } from '@/components/sortable/sortableActions'
import type { SortableNested, SortableNestedItem } from '@/components/sortable/sortableNestedActions'
import type { SortableItemDataAware, SortableItemWithParentDataAware } from '@/components/sortable/sortableUtils'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import {
  type DamDistributionConfig,
  type DamDistributionRequirementsCategorySelectConfig,
  type DamDistributionRequirementsConfig,
  DamDistributionRequirementStrategy,
  DamDistributionServiceType,
  DamDistributionStatus,
  type DamExternalProviderAssetConfig,
  type DamExternalProviderAssetName,
  type DamExtSystemAssetTypeExifMetadata,
  type DamExtSystemConfig,
  type DamExtSystemConfigItem,
  type DamPrvConfig,
  type DamPubConfig,
  UserAuthType,
} from '@/types/coreDam/DamConfig'
import { useUploadQueueItemFactory } from '@/components/damImage/uploadQueue/composables/UploadQueueItemFactory'
import { getAssetTypeByMimeType } from '@/components/damImage/uploadQueue/composables/mimeTypeHelper'
import { useDamUploadChunkSize } from '@/components/damImage/uploadQueue/composables/damUploadChunkSize'
import { damFileTypeFix } from '@/components/file/composables/fileType'
import { useDamAcceptTypeAndSizeHelper } from '@/components/damImage/uploadQueue/composables/acceptTypeAndSizeHelper'
import { useAssetSuggestions } from '@/components/damImage/uploadQueue/composables/assetSuggestions'
import {
  initDamNotifications,
  useDamNotifications,
} from '@/components/damImage/uploadQueue/composables/damNotifications'
import { useDropzoneGlobalDragState } from '@/components/file/composables/dropzone'
import {
  DamNotificationName,
  type DamNotificationNameType,
} from '@/components/damImage/uploadQueue/composables/damNotificationsEventBus'
import type { ImageAware, ImageCreateUpdateAware, ImageCreateUpdateAwareKeyed } from '@/types/ImageAware'
import type { DamAuthor, DamAuthorMinimal } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { DamKeyword, DamKeywordMinimal } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import type { DamExtSystem, DamExtSystemMinimal } from '@/components/damImage/uploadQueue/composables/DamExtSystem'
import { DamAuthorType, useDamAuthorType } from '@/components/damImage/uploadQueue/author/DamAuthorType'
import { useDamKeywordFactory } from '@/components/damImage/uploadQueue/keyword/KeywordFactory'
import { useDamAuthorFactory } from '@/components/damImage/uploadQueue/author/AuthorFactory'
import { cropToRegion, regionToCrop } from '@/components/damImage/uploadQueue/composables/cropperJsService'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'
import { fetchDamCurrentUser } from '@/components/damImage/uploadQueue/api/damCurrentUserApi'
import {
  damCurrentUser,
  damCurrentUserIsSuperAdmin,
  updateDamCurrentUser,
  useDamCurrentUser,
} from '@/components/damImage/composables/damCurrentUser'
import type { DamAssetLicence, DamAssetLicenceMinimal } from '@/types/coreDam/AssetLicence'
import type { DamAssetLicenceGroup } from '@/types/coreDam/AssetLicenceGroup'
import { useCollabInit } from '@/components/collab/composables/collabInit'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'
import { useCollabCurrentUserId } from '@/components/collab/composables/collabCurrentUserId'
import { useCollabState } from '@/components/collab/composables/collabState'
import { useCollabField } from '@/components/collab/composables/collabField'
import { useCollabRoom } from '@/components/collab/composables/collabRoom'
import {
  COLLAB_FIELD_PREFIX_COMMENT,
  COLLAB_FIELD_PREFIX_EMBED,
  type CollabCachedUsersMap,
  useCollabHelpers,
} from '@/components/collab/composables/collabHelpers'
import { useCollabAnyDataChange } from '@/components/collab/composables/collabAnyDataChange'
import {
  type CollabApprovedJoinRequestEvent,
  type CollabApprovedRequestToTakeModerationEvent,
  CollabFieldLockStatus,
  type CollabFieldLockStatusEvent,
  type CollabFieldLockStatusPayload,
  type CollabFieldLockStatusType,
  CollabFieldLockType,
  type CollabFieldLockTypeType,
  type CollabGatheringBufferDataEvent,
  type CollabJoinRequestEvent,
  type CollabKickedFromRoomEvent,
  type CollabRejectedJoinRequestEvent,
  type CollabRejectedRequestToTakeModerationEvent,
  type CollabRequestToTakeModerationEvent,
  type CollabRoomDataChangedEvent,
  type CollabStartingEvent,
  createFieldLockStatusPayload,
  useCollabApprovedJoinRequestEventBus,
  useCollabApprovedRequestToTakeModerationEventBus,
  useCollabFieldLockStatusEventBus,
  useCollabGatheringBufferDataEventBus,
  useCollabJoinRequestEventBus,
  useCollabKickedFromRoomEventBus,
  useCollabReconnectEventBus,
  useCollabRejectedJoinRequestEventBus,
  useCollabRejectedRequestToTakeModerationEventBus,
  useCollabRequestToTakeModerationEventBus,
  useCollabRoomDataChangeEventBus,
  useCollabStartingEventBus,
} from '@/components/collab/composables/collabEventBus'
import {
  type CollabAccessRoomCallbackTypes,
  CollabAccessRoomStatus,
  type CollabAccessRoomStatusType,
  type CollabChangeRoomLockCallbackTypes,
  CollabChangeRoomLockStatus,
  type CollabChangeRoomLockStatusType,
  type CollabClientToServerEvents,
  type CollabComponentConfig,
  type CollabDelayedRequest,
  type CollabFailedAccessRoomCallback,
  type CollabFailedChangeRoomLockCallback,
  type CollabFieldData,
  type CollabFieldDataEnvelope,
  type CollabFieldLock,
  type CollabFieldLockOptions,
  type CollabFieldName,
  type CollabOccupiedAccessRoomCallback,
  CollabRequestToJoinStatus,
  type CollabRequestToJoinStatusCallback,
  type CollabRequestToJoinStatusType,
  CollabRequestToTakeModerationStatus,
  type CollabRequestToTakeModerationStatusCallback,
  type CollabRequestToTakeModerationStatusType,
  type CollabRoom,
  type CollabRoomData,
  type CollabRoomInfo,
  type CollabRoomInfoCallback,
  CollabRoomJoinStrategy,
  type CollabRoomJoinStrategyType,
  type CollabRoomLocks,
  type CollabRoomLocksInfoCallback,
  type CollabRoomOptions,
  type CollabRoomPlainData,
  type CollabRoomsInfo,
  type CollabRouteMeta,
  type CollabServerToClientEvents,
  CollabStatus,
  type CollabStatusType,
  type CollabSuccessAccessRoomCallback,
  type CollabSuccessChangeRoomLockCallback,
  type CollabUserId,
  type CollabUserIdNullable,
  isCollabFailedChangeRoomLockCallback,
  isCollabSuccessChangeRoomLockCallback,
} from '@/components/collab/types/Collab'
import DamAssetLicenceRemoteAutocomplete from '@/components/dam/user/DamAssetLicenceRemoteAutocomplete.vue'
import DamAssetLicenceGroupRemoteAutocomplete from '@/components/dam/user/DamAssetLicenceGroupRemoteAutocomplete.vue'
import DamExtSystemRemoteAutocomplete from '@/components/dam/user/DamExtSystemRemoteAutocomplete.vue'
import DamExternalProviderAssetSelect from '@/components/dam/user/DamExternalProviderAssetSelect.vue'
import DamDistributionServiceSelect from '@/components/dam/user/DamDistributionServiceSelect.vue'
import { useDamDistributionServiceType } from '@/components/dam/user/DamDistributionServiceType'
import { useDamAssetLicenceFilter } from '@/components/dam/user/AssetLicenceFilter'
import { fetchDamAssetLicenceList, fetchDamAssetLicenceListByIds } from '@/components/dam/user/assetLicenceApi'
import {
  fetchDamAssetLicenceGroupList,
  fetchDamAssetLicenceGroupListByIds,
} from '@/components/dam/user/assetLicenceGroupApi'
import { fetchDamExtSystemList, fetchDamExtSystemListByIds } from '@/components/dam/user/extSystemApi'
import type { DamUser, DamUserUpdateDto } from '@/components/dam/user/DamUser'
import { fetchDamUser, fetchDamUserList, fetchDamUserListByIds, updateDamUser } from '@/components/dam/user/userApi'
import { useImageActions } from '@/components/damImage/composables/imageActions'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { defineAuth, ROLE_SUPER_ADMIN } from '@/composables/auth/defineAuth'
import { type BreadcrumbItem, type Breadcrumbs, defineBreadcrumbs } from '@/composables/system/breadcrumbs'

export {
  // COMPONENTS
  ACard,
  ACardLoader,
  ARow,
  AChipNoLink,
  AAlerts,
  ABooleanValue,
  APermissionGrantEditor,
  APermissionValueChip,
  ASystemEntityScope,
  AFormTextField,
  AFormTextarea,
  AFormDatetimePicker,
  AFormFlagDatetimePicker,
  AFormRemoteAutocomplete,
  AFormRemoteCheckbox,
  AFormRemoteSwitch,
  AFormSwitch,
  AFormValueObjectOptionsSelect,
  AFilterWrapper,
  AFilterString,
  AFilterInteger,
  AFilterRemoteAutocomplete,
  AFilterValueObjectOptionsSelect,
  AFilterBooleanGroup,
  AFilterBooleanSelect,
  AFilterDatetimePicker,
  ADatetime,
  ADatetimePicker,
  ADatatablePagination,
  ADatatableConfigButton,
  ADatatableOrdering,
  ADialogToolbar,
  ACreateDialog,
  ALogData,
  AJobStatusChip,
  ACachedChip,
  AAdminSwitcher,
  AEmptyRouterView,
  ATimeTrackingFields,
  Acl,
  ACopyText,
  AIconGroup,
  AUserAndTimeTrackingFields,
  AActionCloseButton,
  AActionCreateButton,
  AActionDeleteButton,
  AActionEditButton,
  AActionSaveAndCloseButton,
  AActionSaveButton,
  AFilterAdvancedButton,
  AFilterResetButton,
  AFilterSubmitButton,
  AFilterMixed,
  ATableCopyIdButton,
  ATableDetailButton,
  ATableEditButton,
  ABtnSplit,
  AThemeSelect,
  ALanguageSelect,
  ASystemBar,
  ALogLevelChip,
  AAnzuUserAvatar,
  AAvatarColorPicker,
  ACurrentUserDropdown,
  AFormRemoteAutocompleteWithCached,
  AJobDetailCommon,
  AJobPriorityChip,
  AJobBaseCreateForm,
  ASortable,
  ASortableNested,
  ASubjectSelect,
  ACustomDataForm,
  ACustomDataFormElement,
  AImageWidget,
  AImageWidgetSimple,
  AImageWidgetMultiple,
  AImageWidgetMultipleSimple,
  AImagePublicInput,
  ACropperjs,
  ACollabLockedByUser,
  ACollabCountdown,
  ACollabManagement,
  AAssetSelect,
  ADatatable,
  ABooleanSelect,
  DamExtSystemRemoteAutocomplete,
  DamExternalProviderAssetSelect,
  DamDistributionServiceSelect,
  DamAssetLicenceRemoteAutocomplete,
  DamAssetLicenceGroupRemoteAutocomplete,

  // VIEWS
  ALoginView,
  ALogoutView,
  AUnauthorizedView,
  ANotFoundView,

  // COMPOSABLES
  usePagination,
  usePaginationAutoHide,
  useFilterHelpers,
  makeFilterHelper,
  useRemainingTime,
  useAlerts,
  useErrors,
  createDatatableColumnsConfig,
  useTheme,
  defineCached,
  Theme,
  useLanguageSettings,
  modifyLanguageSettings,
  useLoginStatus,
  useSubjectSelect,
  generateDatatableMinMaxSelectStrategy,
  useCustomDataForm,
  useCustomDataFormElementType,
  useDamConfigState,
  useUploadQueueItemFactory,
  useDamUploadChunkSize,
  useDamAcceptTypeAndSizeHelper,
  useAssetSuggestions,
  initDamNotifications,
  useDamNotifications,
  useDropzoneGlobalDragState,
  useDamKeywordFactory,
  useDamAuthorFactory,
  useDamAuthorType,
  useDamCurrentUser,
  updateDamCurrentUser,
  useDamDistributionServiceType,
  useDamAssetLicenceFilter,
  useImageActions,
  useCommonAdminImageOptions,
  defineAuth,
  defineBreadcrumbs,

  // VALUE OBJECTS
  Grant,
  useGrant,
  GrantOrigin,
  useGrantOrigin,
  LogLevel,
  useLogLevel,

  // TYPES
  type IntegerId,
  type IntegerIdNullable,
  type DocId,
  type DocIdNullable,
  type DatetimeUTCNullable,
  type DatetimeUTC,
  type AnzuUser,
  type AnzuUserMinimal,
  type AnzuUserAndTimeTrackingAware,
  type ValueObjectOption,
  type Pagination,
  type OwnerAware,
  isOwnerAware,
  type CreatedByAware,
  isCreatedByAware,
  type Filter,
  type FilterBag,
  type FilterVariant,
  type PermissionConfig,
  type PermissionTranslationGroup,
  type PermissionGroup,
  type PermissionGroupMinimal,
  type VuetifyIconValue,
  type MakeFilterOptions,
  type JobBase,
  type JobUserDataDelete,
  JOB_RESOURCE_USER_DATA_DELETE,
  JobStatus,
  type JobBaseResource,
  useCommonJobFactory,
  type CurrentUserType,
  type AclValue,
  type Permissions,
  type CustomAclResolver,
  type PluginOptions,
  type LanguageCode,
  type Immutable,
  type ResourceNameSystemAware,
  type ValidationScope,
  type Log,
  type ApiResponseList,
  type ApiInfiniteResponseList,
  type DatatableOrderingOption,
  type DatatableOrderingOptions,
  type DatatableSortBy,
  type ObjectPaths,
  type ObjectLeaves,
  type Prettify,
  type EnableDisable,
  type CachedItem,
  type RecordWasType,
  type UrlParams,
  type AssetSelectReturnData,
  type SortablePropItem,
  type SortableItem,
  type SortableNestedItem,
  type SortableNested,
  type SortableItemDataAware,
  type SortableItemWithParentDataAware,
  type AssetFileProperties,
  type AssetSearchListItemDto,
  type AssetDetailItemDto,
  type AssetMetadataDto,
  type AssetCustomData,
  type AssetMetadataSuggestions,
  AssetFileFailReason,
  AssetFileProcessStatus,
  AssetFileLinkType,
  type AssetFile,
  type AssetFileDocument,
  type AssetFileVideo,
  type AssetFileAudio,
  type AssetFileImage,
  type AssetFileNullable,
  type AssetFileLink,
  type AssetFileLinks,
  type AssetFileRoute,
  type AssetFileRouteStatus,
  type AssetFileMainRouteAware,
  type AssetFileDownloadLink,
  type AssetFileImagePreviewNullable,
  assetFileIsImageFile,
  assetFileIsVideoFile,
  assetFileIsAudioFile,
  assetFileIsDocumentFile,
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
  type CustomDataAware,
  type CustomDataFormElement,
  type CustomDataFormElementAttributes,
  CustomDataFormElementType,
  CustomDataFormElementTypeDefault,
  type CustomDataFormElementTypeType,
  DamAssetType,
  DamAssetStatus,
  type DamPubConfig,
  type DamPrvConfig,
  type DamExtSystemConfig,
  type DamDistributionServiceName,
  type DamExtSystemConfigItem,
  type DamExternalProviderAssetConfig,
  type DamExternalProviderAssetName,
  type DamDistributionConfig,
  type DamDistributionRequirementsConfig,
  DamDistributionRequirementStrategy,
  type DamDistributionRequirementsCategorySelectConfig,
  type DamExtSystemAssetTypeExifMetadata,
  DamDistributionServiceType,
  DamDistributionStatus,
  UserAuthType,
  type DamUploadStartResponse,
  type DamNotificationNameType,
  DamNotificationName,
  type ImageAware,
  type ImageCreateUpdateAware,
  type ImageCreateUpdateAwareKeyed,
  type DamAuthor,
  type DamAuthorMinimal,
  type DamKeyword,
  type DamKeywordMinimal,
  DamAuthorType,
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
  isEmptyArray,
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
  objectGetValues,
  objectGetValueByPath,
  objectSetValueByPath,
  objectDeletePropertyByPath,
  objectDeepFreeze,
  // string
  stringToInt,
  stringToFloat,
  stringToSlug,
  stringSplitOnFirstOccurrence,
  stringTrimLength,
  stringToKebabCase,
  stringNormalizeForSlotName,
  stringIsValidEmail,
  stringUrlTemplateReplace,
  stringUrlTemplateReplaceVueRouter,
  // datetime
  DATETIME_MIN,
  DATETIME_MAX,
  timestampCurrent,
  dateTimeEndOfDay,
  dateTimeStartOfDay,
  dateTimeNow,
  dateTimeFriendly,
  dateTimePretty,
  dateModifyMinutes,
  dateToUtc,
  dateNow,
  dateTimeToDate,
  yearNow,
  datePretty,
  timePretty,
  dateDiff,
  // file
  prettyBytes,
  // response
  isValidHTTPStatus,
  // number
  numberToString,
  // boolean
  booleanToInteger,
  // array
  arrayItemToggle,
  arrayToString,
  arrayFromArgs,
  arrayFlatten,
  type NestedArray,
  arraysHaveSameElements,
  // history
  browserHistoryReplaceUrlByString,
  browserHistoryReplaceUrlByRouter,
  // event
  eventClickBlur,
  // generator
  generateUUIDv1,
  generateUUIDv4,

  // SERVICES
  apiAnyRequest,
  apiCreateOne,
  apiDeleteOne,
  apiFetchByIds,
  apiFetchList,
  apiFetchListBatch,
  apiFetchOne,
  apiUpdateOne,
  useApiQueryBuilder,
  apiGenerateListQuery,
  useJobApi,
  useJobBaseResource,
  useJobStatus,
  useAcl,
  regionToCrop,
  cropToRegion,
  fetchDamAssetLicenceListByIds,
  fetchDamAssetLicenceList,
  fetchDamAssetLicenceGroupListByIds,
  fetchDamAssetLicenceGroupList,
  fetchDamExtSystemListByIds,
  fetchDamExtSystemList,
  fetchDamUserListByIds,
  fetchDamUserList,
  updateDamUser,
  fetchDamUser,

  // TRANSLATIONS
  messagesCs,
  messagesEn,
  messagesSk,

  // SYMBOLS, CONSTANTS
  SystemScopeSymbol,
  SubjectScopeSymbol,
  AvailableLanguagesSymbol,
  DefaultLanguageSymbol,
  HTTP_STATUS_OK,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_FORBIDDEN,
  HTTP_STATUS_UNPROCESSABLE_ENTITY,
  ROLE_SUPER_ADMIN,
  NEW_LINE_MARK,
  COMMON_CONFIG,

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
  type CollabRoomDataChangedEvent,
  type CollabJoinRequestEvent,
  type CollabApprovedJoinRequestEvent,
  type CollabRejectedJoinRequestEvent,
  type CollabStartingEvent,
  type CollabGatheringBufferDataEvent,
  type CollabRequestToTakeModerationEvent,
  type CollabApprovedRequestToTakeModerationEvent,
  type CollabRejectedRequestToTakeModerationEvent,
  type CollabKickedFromRoomEvent,
  useCollabRoomDataChangeEventBus,
  useCollabReconnectEventBus,
  useCollabStartingEventBus,
  useCollabGatheringBufferDataEventBus,
  useCollabApprovedJoinRequestEventBus,
  useCollabRejectedJoinRequestEventBus,
  useCollabJoinRequestEventBus,
  useCollabApprovedRequestToTakeModerationEventBus,
  useCollabRejectedRequestToTakeModerationEventBus,
  useCollabRequestToTakeModerationEventBus,
  useCollabKickedFromRoomEventBus,
  CollabFieldLockType,
  type CollabFieldLockTypeType,
  CollabFieldLockStatus,
  type CollabFieldLockStatusType,
  type CollabFieldLockStatusPayload,
  createFieldLockStatusPayload,
  type CollabFieldLockStatusEvent,
  useCollabFieldLockStatusEventBus,
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
  type CollabRoomInfoCallback,
  type CollabSuccessAccessRoomCallback,
  type CollabOccupiedAccessRoomCallback,
  type CollabFailedAccessRoomCallback,
  type CollabAccessRoomCallbackTypes,
  CollabChangeRoomLockStatus,
  type CollabChangeRoomLockStatusType,
  type CollabRoomLocksInfoCallback,
  type CollabSuccessChangeRoomLockCallback,
  type CollabFailedChangeRoomLockCallback,
  type CollabChangeRoomLockCallbackTypes,
  isCollabSuccessChangeRoomLockCallback,
  isCollabFailedChangeRoomLockCallback,
  type CollabFieldLockOptions,
  CollabRoomJoinStrategy,
  type CollabRoomJoinStrategyType,
  type CollabRoomOptions,
  CollabRequestToTakeModerationStatus,
  type CollabRequestToTakeModerationStatusType,
  type CollabRequestToTakeModerationStatusCallback,
  CollabRequestToJoinStatus,
  type CollabRequestToJoinStatusType,
  type CollabRequestToJoinStatusCallback,
  type CollabClientToServerEvents,
  type CollabServerToClientEvents,
  type CollabRouteMeta,
  type CollabDelayedRequest,
  type CollabCachedUsersMap,
  type CollabComponentConfig,
  COLLAB_FIELD_PREFIX_EMBED,
  COLLAB_FIELD_PREFIX_COMMENT,

  // OTHER
  i18n,
  useI18n,
  isAnzuApiForbiddenError,
  axiosErrorResponseIsForbidden,
  AnzuApiForbiddenError,
  isAnzuApiResponseCodeError,
  AnzuApiResponseCodeError,
  isAnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
  AnzuApiForbiddenOperationError,
  isAnzuApiValidationError,
  axiosErrorResponseHasValidationData,
  AnzuApiValidationError,
  isAnzuFatalError,
  AnzuFatalError,
  type ValidationError,
  type AnzuApiValidationResponseData,
  AnzuSystemsCommonAdmin,
  useCommonVuetifyConfig,
  loadCommonFonts,
  getAssetTypeByMimeType,
  damFileTypeFix,
  fetchDamCurrentUser,
  damCurrentUser,
  damCurrentUserIsSuperAdmin,
}
