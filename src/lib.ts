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
import ADatetime from '@/components/ADatetime.vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'
import AFormFlagDatetimePicker from '@/components/form/AFormFlagDatetimePicker.vue'
import AFilterDatetimePicker from '@/components/filter/AFilterDatetimePicker.vue'
import AFormRemoteAutocomplete from '@/components/form/AFormRemoteAutocomplete.vue'
import AFormRemoteCheckbox from '@/components/form/AFormRemoteCheckbox.vue'
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
import ACropperjs from '@/components/ACropperjs.vue'
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
import { apiFetchList } from '@/services/api/apiFetchList'
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
import { ROLE_SUPER_ADMIN, useAcl } from '@/composables/system/ability'
import AnzuSystemsCommonAdmin, {
  type CurrentUserType,
  type CustomAclResolver,
  type PluginOptions,
} from '@/AnzuSystemsCommonAdmin'
import type { AclValue } from '@/types/Permission'
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
  type AssetFileNullable,
  AssetFileProcessStatus,
  type AssetFileVideo,
  type AssetFileRoute,
  type AssetFileRouteStatus,
  type AssetFileMainRouteAware,
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
import { regionToCrop, cropToRegion } from '@/components/damImage/uploadQueue/composables/cropperJsService'

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
  ASortable,
  ASortableNested,
  ASubjectSelect,
  ACustomDataForm,
  ACustomDataFormElement,
  AImageWidget,
  AImageWidgetSimple,
  AImageWidgetMultiple,
  AImageWidgetMultipleSimple,
  ACropperjs,

  // Dam
  AAssetSelect,

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

  // VALUE OBJECTS
  Grant,
  useGrant,
  GrantOrigin,
  useGrantOrigin,
  LogLevel,
  useLogLevel,

  // TYPES
  IntegerId,
  IntegerIdNullable,
  DocId,
  DocIdNullable,
  DatetimeUTCNullable,
  DatetimeUTC,
  AnzuUser,
  AnzuUserMinimal,
  AnzuUserAndTimeTrackingAware,
  ValueObjectOption,
  Pagination,
  OwnerAware,
  isOwnerAware,
  CreatedByAware,
  isCreatedByAware,
  Filter,
  FilterBag,
  FilterVariant,
  PermissionConfig,
  PermissionTranslationGroup,
  PermissionGroup,
  PermissionGroupMinimal,
  VuetifyIconValue,
  MakeFilterOptions,
  JobBase,
  JobUserDataDelete,
  JOB_RESOURCE_USER_DATA_DELETE,
  JobStatus,
  JobBaseResource,
  useCommonJobFactory,
  CurrentUserType,
  AclValue,
  CustomAclResolver,
  PluginOptions,
  LanguageCode,
  Immutable,
  ResourceNameSystemAware,
  ValidationScope,
  Log,
  ApiResponseList,
  ApiInfiniteResponseList,
  DatatableOrderingOption,
  DatatableOrderingOptions,
  DatatableSortBy,
  ObjectPaths,
  ObjectLeaves,
  Prettify,
  EnableDisable,
  CachedItem,
  RecordWasType,
  UrlParams,
  AssetSelectReturnData,
  SortablePropItem,
  SortableItem,
  SortableNestedItem,
  SortableNested,
  SortableItemDataAware,
  SortableItemWithParentDataAware,
  AssetFileProperties,
  AssetSearchListItemDto,
  AssetDetailItemDto,
  AssetMetadataDto,
  AssetCustomData,
  AssetMetadataSuggestions,
  AssetFileFailReason,
  AssetFileProcessStatus,
  AssetFileLinkType,
  AssetFile,
  AssetFileDocument,
  AssetFileVideo,
  AssetFileAudio,
  AssetFileImage,
  AssetFileNullable,
  AssetFileLink,
  AssetFileLinks,
  AssetFileRoute,
  AssetFileRouteStatus,
  AssetFileMainRouteAware,
  AssetFileDownloadLink,
  AssetFileImagePreviewNullable,
  assetFileIsImageFile,
  assetFileIsVideoFile,
  assetFileIsAudioFile,
  assetFileIsDocumentFile,
  UploadQueue,
  UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
  CustomDataAware,
  CustomDataFormElement,
  CustomDataFormElementAttributes,
  CustomDataFormElementType,
  CustomDataFormElementTypeDefault,
  CustomDataFormElementTypeType,
  DamAssetType,
  DamAssetStatus,
  DamPubConfig,
  DamPrvConfig,
  DamExtSystemConfig,
  DamDistributionServiceName,
  DamExtSystemConfigItem,
  DamExternalProviderAssetConfig,
  DamExternalProviderAssetName,
  DamDistributionConfig,
  DamDistributionRequirementsConfig,
  DamDistributionRequirementStrategy,
  DamDistributionRequirementsCategorySelectConfig,
  DamExtSystemAssetTypeExifMetadata,
  DamDistributionServiceType,
  DamDistributionStatus,
  UserAuthType,
  DamUploadStartResponse,
  DamNotificationNameType,
  DamNotificationName,
  ImageAware,
  ImageCreateUpdateAware,
  ImageCreateUpdateAwareKeyed,
  DamAuthor,
  DamAuthorMinimal,
  DamKeyword,
  DamKeywordMinimal,
  DamAuthorType,
  DamExtSystem,
  DamExtSystemMinimal,

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
  NestedArray,
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
  useJobApi,
  useJobBaseResource,
  useJobStatus,
  useAcl,
  regionToCrop,
  cropToRegion,

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
  ValidationError,
  AnzuApiValidationResponseData,
  AnzuSystemsCommonAdmin,
  useCommonVuetifyConfig,
  loadCommonFonts,
  getAssetTypeByMimeType,
  damFileTypeFix,
}
