import ABooleanValue from '@/components/ABooleanValue.vue'
import ARow from '@/components/ARow.vue'
import AAlerts from '@/components/AAlerts.vue'
import ACard from '@/components/ACard.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import AFormBooleanToggle from '@/components/form/AFormBooleanToggle.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import ADatatable from '@/components/ADatatable.vue'
import ADatatablePagination from '@/components/ADatatablePagination.vue'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterInteger from '@/components/filter/AFilterInteger.vue'
import AFilterWrapper from '@/components/filter/AFilterWrapper.vue'
import APermissionGrantEditor from '@/components/permission/APermissionGrantEditor.vue'
import APermissionValueChip from '@/components/permission/APermissionValueChip.vue'
import Acl from '@/components/permission/Acl.vue'
import ADatetime from '@/components/ADatetime.vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'
import AFilterDatetimePicker from '@/components/filter/AFilterDatetimePicker.vue'
import AFormRemoteAutocomplete from '@/components/form/AFormRemoteAutocomplete.vue'
import AFormValueObjectOptionsSelect from '@/components/form/AFormValueObjectOptionsSelect.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter/AFilterValueObjectOptionsSelect.vue'
import AFilterRemoteAutocomplete from '@/components/filter/AFilterRemoteAutocomplete.vue'
import AFilterBooleanGroup from '@/components/filter/AFilterBooleanGroup.vue'
import AJobStatusChip from '@/components/job/AJobStatusChip.vue'
import ALogLevelChip from '@/components/log/ALogLevelChip.vue'
import ACopyText from '@/components/ACopyText.vue'
import AIconGroup from '@/components/AIconGroup.vue'
import APageTitle from '@/components/APageTitle.vue'
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
import AThemeSelect from '@/components/AThemeSelect.vue'
import ALanguageSelect from '@/components/ALanguageSelect.vue'
import ASystemBar from '@/components/systemBar/ASystemBar.vue'
import { i18n } from '@/plugins/i18n'
import {
  objectDeletePropertyByPath,
  objectGetValueByPath,
  objectGetValues,
  type Immutable,
  objectDeepFreeze,
  objectSetValueByPath,
} from '@/utils/object'
import { numberToString } from '@/utils/number'
import {
  isArray,
  isBoolean,
  isDefined,
  isDocId,
  isEmpty,
  isEmptyArray,
  isEmptyObject,
  isInt,
  isNull,
  isNumber,
  isObject,
  isString,
  isUndefined,
  cloneDeep,
} from '@/utils/common'
import {
  stringNormalizeForSlotName,
  stringToSlug,
  stringSplitOnFirstOccurrence,
  stringToFloat,
  stringToInt,
  stringTrimLength,
  stringToKebabCase,
  stringUrlTemplateReplace,
} from '@/utils/string'
import { booleanToInteger } from '@/utils/boolean'
import {
  timestampCurrent,
  DATETIME_MAX,
  DATETIME_MIN,
  dateTimeEndOfDay,
  dateTimeNow,
  dateTimeStartOfDay,
  dateToUtc,
  dateTimeFriendly,
  dateModifyMinutes,
  dateNow,
  dateTimePretty,
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
  IntegerId,
  IntegerIdNullable,
} from '@/types/common'
import type { Filter, FilterBag, FilterVariant } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'
import type { OwnerAware } from '@/types/OwnerAware'
import { isOwnerAware } from '@/types/OwnerAware'
import type { AnzuUser } from '@/types/AnzuUser'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { PermissionConfig, PermissionTranslationGroup } from '@/types/PermissionConfig'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import type { PermissionGroup, PermissionGroupMinimal } from '@/types/PermissionGroup'
import { type CreatedByAware, isCreatedByAware } from '@/types/CreatedByAware'
import type { VuetifyIconValue } from '@/types/Vuetify'
import { usePagination, usePaginationAutoHide } from '@/composables/system/pagination'
import { makeFilterHelper, type MakeFilterOptions, useFilterHelpers } from '@/composables/filter/filterHelpers'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { prettyBytes } from '@/utils/file'
import { isValidHTTPStatus } from '@/utils/response'
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_CREATED,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_OK,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_UNPROCESSABLE_ENTITY,
} from '@/composables/statusCodes'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiValidationError } from '@/model/error/AnzuApiValidationError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { apiAnyRequest } from '@/services/api/apiAnyRequest'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiDeleteOne } from '@/services/api/apiDeleteOne'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiFetchList } from '@/services/api/apiFetchList'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { useApiQueryBuilder } from '@/services/api/queryBuilder'
import { NEW_LINE_MARK, useAlerts } from '@/composables/system/alerts'
import { type ApiErrors, useErrorHandler, type ValidationResponseData } from '@/composables/system/error'
import { JobStatus, useJobStatus } from '@/model/valueObject/JobStatus'
import type { Job } from '@/types/Job'
import { useJobApi } from '@/services/api/job/jobApi'
import { type JobResource, useJobResource } from '@/model/valueObject/JobResource'
import { ROLE_SUPER_ADMIN, useAcl } from '@/composables/system/ability'
import AnzuSystemsCommonAdmin, {
  AvailableLanguagesSymbol,
  type CurrentUserType,
  DefaultLanguageSymbol,
  type PluginOptions,
  type CustomAclResolver,
} from '@/AnzuSystemsCommonAdmin'
import type { AclValue } from '@/types/Permission'
import { useTheme } from '@/composables/themeSettings'
import { type LanguageCode, modifyLanguageSettings, useLanguageSettings } from '@/composables/languageSettings'
import { type DatatableColumnConfig, useDatatableColumns } from '@/composables/system/datatableColumns'
import { arrayFromArgs, arrayToString, arrayFlatten, arrayItemToggle, type NestedArray } from '@/utils/array'
import { browserHistoryReplaceUrlByRouter, browserHistoryReplaceUrlByString } from '@/utils/history'
import { eventClickBlur } from '@/utils/event'
import type { ResourceNameSystemAware } from '@/types/ResourceNameSystemAware'
import type { ValidationScope } from '@/types/Validation'
import { useI18n } from 'vue-i18n'
import { useValidateRequired } from '@/validators/vuelidate/useValidateRequired'
import { useValidateRequiredIf } from '@/validators/vuelidate/useValidateRequiredIf'
import { useValidateSlug } from '@/validators/vuelidate/useValidateSlug'
import { useValidateUrl } from '@/validators/vuelidate/useValidateUrl'
import { useValidateStringArrayItemLength } from '@/validators/vuelidate/useValidateStringArrayItemLength'
import { useValidateBetween } from '@/validators/vuelidate/useValidateBetween'
import { useValidateEmail } from '@/validators/vuelidate/useValidateEmail'
import { useValidateLatitude } from '@/validators/vuelidate/useValidateLatitude'
import { useValidateLatitudeNotZeroAsLongitude } from '@/validators/vuelidate/useValidateLatitudeNotZeroAsLongitude'
import { useValidateLongitude } from '@/validators/vuelidate/useValidateLongitude'
import { useValidateMaxLength } from '@/validators/vuelidate/useValidateMaxLength'
import { useValidateMaxValue } from '@/validators/vuelidate/useValidateMaxValue'
import { useValidateMinLength } from '@/validators/vuelidate/useValidateMinLength'
import { useValidateMinValue } from '@/validators/vuelidate/useValidateMinValue'
import { useValidateNumeric } from '@/validators/vuelidate/useValidateNumeric'
import { useValidatePhoneNumber } from '@/validators/vuelidate/useValidatePhoneNumber'
import { useValidateLongitudeNotZeroAsLatitude } from '@/validators/vuelidate/useValidateLongitudeNotZeroAsLatitude'
import messagesEn from '@/locales/en'
import messagesSk from '@/locales/sk'
import type { Log } from '@/types/Log'
import { LogLevel, useLogLevel } from '@/model/valueObject/LogLevel'
import '@/styles/main.scss'
import type { ICON } from '@/model/icons'

export {
  // COMPONENTS
  ACard,
  ARow,
  AAlerts,
  ABooleanValue,
  APermissionGrantEditor,
  APermissionValueChip,
  ASystemEntityScope,
  AFormTextField,
  AFormTextarea,
  AFormDatetimePicker,
  AFormRemoteAutocomplete,
  AFormValueObjectOptionsSelect,
  AFormBooleanToggle,
  AFilterWrapper,
  AFilterString,
  AFilterInteger,
  AFilterRemoteAutocomplete,
  AFilterValueObjectOptionsSelect,
  AFilterBooleanGroup,
  AFilterDatetimePicker,
  ADatetime,
  ADatatable,
  ADatatablePagination,
  AJobStatusChip,
  Acl,
  ACopyText,
  AIconGroup,
  APageTitle,
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
  ATableCopyIdButton,
  ATableDetailButton,
  ATableEditButton,
  AThemeSelect,
  ALanguageSelect,
  ASystemBar,
  ALogLevelChip,

  // COMPOSABLES
  usePagination,
  usePaginationAutoHide,
  useFilterHelpers,
  makeFilterHelper,
  useAlerts,
  useErrorHandler,
  useDatatableColumns,
  useTheme,
  useLanguageSettings,
  modifyLanguageSettings,

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
  Job,
  JobStatus,
  JobResource,
  CurrentUserType,
  AclValue,
  CustomAclResolver,
  PluginOptions,
  LanguageCode,
  DatatableColumnConfig,
  ApiErrors,
  ValidationResponseData,
  Immutable,
  ResourceNameSystemAware,
  ValidationScope,
  Log,

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
  stringUrlTemplateReplace,
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
  yearNow,
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
  // history
  browserHistoryReplaceUrlByString,
  browserHistoryReplaceUrlByRouter,
  // event
  eventClickBlur,

  // SERVICES
  apiAnyRequest,
  apiCreateOne,
  apiDeleteOne,
  apiFetchByIds,
  apiFetchList,
  apiFetchOne,
  apiUpdateOne,
  useApiQueryBuilder,
  useJobApi,
  useJobResource,
  useJobStatus,
  useAcl,

  // TRANSLATIONS
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
  HTTP_STATUS_UNPROCESSABLE_ENTITY,
  ROLE_SUPER_ADMIN,
  NEW_LINE_MARK,
  ICON,

  // VALIDATIONS
  useValidateRequired,
  useValidateRequiredIf,
  useValidateSlug,
  useValidateUrl,
  useValidateStringArrayItemLength,
  useValidateBetween,
  useValidateEmail,
  useValidateLatitude,
  useValidateLatitudeNotZeroAsLongitude,
  useValidateLongitude,
  useValidateLongitudeNotZeroAsLatitude,
  useValidateMaxLength,
  useValidateMaxValue,
  useValidateMinLength,
  useValidateMinValue,
  useValidateNumeric,
  useValidatePhoneNumber,

  // OTHER
  i18n,
  useI18n,
  AnzuApiResponseCodeError,
  AnzuApiValidationError,
  AnzuFatalError,
  AnzuSystemsCommonAdmin,
}
