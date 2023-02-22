import ABooleanValue from '@/components/ABooleanValue.vue'
import ARow from '@/components/ARow.vue'
import AAlerts from '@/components/AAlerts.vue'
import ACard from '@/components/ACard.vue'
import ATextField from '@/components/form/ATextField.vue'
import ATextarea from '@/components/form/ATextarea.vue'
import ABooleanToggle from '@/components/form/ABooleanToggle.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import ADatatable from '@/components/ADatatable.vue'
import ADatatablePagination from '@/components/ADatatablePagination.vue'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterWrapper from '@/components/filter/AFilterWrapper.vue'
import APermissionGrantEditor from '@/components/permission/APermissionGrantEditor.vue'
import APermissionValueChip from '@/components/permission/APermissionValueChip.vue'
import Acl from '@/components/permission/Acl.vue'
import ADatetime from '@/components/ADatetime.vue'
import ADatetimePicker from '@/components/ADatetimePicker.vue'
import ARemoteAutocomplete from '@/components/form/ARemoteAutocomplete.vue'
import AValueObjectOptionsSelect from '@/components/form/AValueObjectOptionsSelect.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter/AFilterValueObjectOptionsSelect.vue'
import AFilterRemoteAutocomplete from '@/components/filter/AFilterRemoteAutocomplete.vue'
import AFilterBooleanGroup from '@/components/filter/AFilterBooleanGroup.vue'
import JobStatusChip from '@/components/job/JobStatusChip.vue'
import { commonMessages } from '@/locales'
import { deepFreeze, deletePropertyByPath, getValueByPath, setValueByPath, simpleCloneObject } from '@/utils/object'
import {
  isArray,
  isBoolean,
  isDocId,
  isEmpty,
  isEmptyArray,
  isEmptyObject,
  isInt,
  isNotUndefined,
  isNull,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from '@/utils/common'
import {
  normalizeForSlotName,
  slugify,
  splitOnFirstOccurrence,
  toFloat,
  toInt,
  toKebabCase,
  trimLength,
} from '@/utils/string'
import {
  currentTimestamp,
  DATETIME_MAX,
  DATETIME_MIN,
  dateTimeEndOfDay,
  dateTimeNow,
  dateTimeStartOfDay,
  dateToUtc,
  friendlyDateTime,
  modifyMinutesOfDate,
  newDateNow,
  prettyDateTime,
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
import { type AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
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
import { useQueryBuilder } from '@/services/api/queryBuilder'
import { NEW_LINE_MARK, useAlerts } from '@/composables/system/alerts'
import { useErrorHandler } from '@/composables/system/error'
import { useTableColumns } from '@/composables/system/tableColumns'
import { JobStatus, useJobStatus } from './model/valueObject/JobStatus'
import type { Job } from './types/Job'
import { useJobApi } from './services/api/job/jobApi'
import { type JobResource, useJobResource } from './model/valueObject/JobResource'
import { ROLE_SUPER_ADMIN, useAcl } from './composables/system/ability'
import AnzuSystemsCommonAdmin, { type PluginOptions, type CurrentUserType } from './AnzuSystemsCommonAdmin'
import type { AclValue } from './types/Permission'

/* eslint-disable */
// ITEM ------------------------------------- FORUM --- BLOG --- DAM --- INHOUSE --- CMS ---
export {                                //           |        |       |           |       |
  // COMPONENTS                         //           |        |       |           |       |
  ACard,                                //           |        |       |           |       |
  ARow,                                 //           |        |       |           |       |
  AAlerts,                              //           |        |       |           |       |
  ABooleanValue,                        //           |        |       |           |       |
  APermissionGrantEditor,               //           |        |       |           |       |
  APermissionValueChip,                 //           |        |       |           |       |
  ASystemEntityScope,                   //           |        |       |           |       |
  ATextField,                           //           |        |       |           |       |
  ATextarea,                            //           |        |       |           |       |
  ADatetimePicker,                      //           |        |       |           |       |
  ARemoteAutocomplete,                  //           |        |       |           |       |
  AValueObjectOptionsSelect,            //           |        |       |           |       |
  ABooleanToggle,                       //           |        |       |           |       |
  AFilterWrapper,                       //           |        |       |           |       |
  AFilterString,                        //           |        |       |           |       |
  AFilterRemoteAutocomplete,            //           |        |       |           |       |
  AFilterValueObjectOptionsSelect,      //           |        |       |           |       |
  AFilterBooleanGroup,                  //           |        |       |           |       |
  ADatetime,                            //           |        |       |           |       |
  ADatatable,                           //           |        |       |           |       |
  ADatatablePagination,                 //           |        |       |           |       |
  JobStatusChip,                        //           |        |       |           |       |
  Acl,                                  //           |        |       |           |       |
                                        //           |        |       |           |       |
  // COMPOSABLES                        //           |        |       |           |       |
  usePagination, usePaginationAutoHide, //           |        |       |           |       |
  makeFilterHelper, useFilterHelpers,   //           |        |       |           |       |
  useAlerts,                            //           |        |       |           |       |
  useErrorHandler,                      //           |        |       |           |       |
  useTableColumns,                      //           |        |       |           |       |
                                        //           |        |       |           |       |
  // VALUE OBJECTS                      //           |        |       |           |       |
  Grant, useGrant,                      //           |        |       |           |       |
  GrantOrigin, useGrantOrigin,          //           |        |       |           |       |
                                        //           |        |       |           |       |
  // TYPES                              //           |        |       |           |       |
  IntegerId,                            //           |        |       |           |       |
  IntegerIdNullable,                    //           |        |       |           |       |
  DocId,                                //           |        |       |           |       |
  DocIdNullable,                        //           |        |       |           |       |
  DatetimeUTCNullable,                  //           |        |       |           |       |
  DatetimeUTC,                          //           |        |       |           |       |
  AnzuUser,                             //           |        |       |           |       |
  AnzuUserAndTimeTrackingAware,         //           |        |       |           |       |
  ValueObjectOption,                    //           |        |       |           |       |
  Pagination,                           //           |        |       |           |       |
  OwnerAware,                           //           |        |       |           |       |
  isOwnerAware,                         //           |        |       |           |       |
  CreatedByAware,                       //           |        |       |           |       |
  isCreatedByAware,                     //           |        |       |           |       |
  Filter,                               //           |        |       |           |       |
  FilterBag,                            //           |        |       |           |       |
  FilterVariant,                        //           |        |       |           |       |
  PermissionConfig,                     //           |        |       |           |       |
  PermissionTranslationGroup,           //           |        |       |           |       |
  PermissionGroup,                      //           |        |       |           |       |
  PermissionGroupMinimal,               //           |        |       |           |       |
  VuetifyIconValue,                     //           |        |       |           |       |
  MakeFilterOptions,                    //           |        |       |           |       |
  Job,                                  //           |        |       |           |       |
  JobStatus,                            //           |        |       |           |       |
  JobResource,                          //           |        |       |           |       |
  CurrentUserType,                      //           |        |       |           |       |
                                        //           |        |       |           |       |
  // Factories                          //           |        |       |           |       |
  useAnzuUserFactory,                   //           |        |       |           |       |
  usePermissionConfigFactory,           //           |        |       |           |       |
  usePermissionGroupFactory,            //           |        |       |           |       |
                                        //           |        |       |           |       |
  // UTILS                              //           |        |       |           |       |
  // common                             //           |        |       |           |       |
  isEmpty,                              //           |        |       |           |       |
  isEmptyObject,                        //           |        |       |           |       |
  isObject,                             //           |        |       |           |       |
  isEmptyArray,                         //           |        |       |           |       |
  isArray,                              //           |        |       |           |       |
  isBoolean,                            //           |        |       |           |       |
  isDocId,                              //           |        |       |           |       |
  isNull,                               //           |        |       |           |       |
  isNotUndefined,                       //           |        |       |           |       |
  isUndefined,                          //           |        |       |           |       |
  isInt,                                //           |        |       |           |       |
  isString,                             //           |        |       |           |       |
  isNumber,                             //           |        |       |           |       |
  // object                             //           |        |       |           |       |
  setValueByPath,                       //           |        |       |           |       |
  deletePropertyByPath,                 //           |        |       |           |       |
  deepFreeze,                           //           |        |       |           |       |
  simpleCloneObject,                    //           |        |       |           |       |
  getValueByPath,                       //           |        |       |           |       |
  // string                             //           |        |       |           |       |
  toInt,                                //           |        |       |           |       |
  slugify,                              //           |        |       |           |       |
  toFloat,                              //           |        |       |           |       |
  splitOnFirstOccurrence,               //           |        |       |           |       |
  trimLength,                           //           |        |       |           |       |
  normalizeForSlotName,                 //           |        |       |           |       |
  toKebabCase,                          //           |        |       |           |       |
  // datetime                           //           |        |       |           |       |
  currentTimestamp,                     //           |        |       |           |       |
  DATETIME_MAX,                         //           |        |       |           |       |
  DATETIME_MIN,                         //           |        |       |           |       |
  dateTimeEndOfDay,                     //           |        |       |           |       |
  dateTimeStartOfDay,                   //           |        |       |           |       |
  dateTimeNow,                          //           |        |       |           |       |
  friendlyDateTime,                     //           |        |       |           |       |
  newDateNow,                           //           |        |       |           |       |
  prettyDateTime,                       //           |        |       |           |       |
  dateToUtc,                            //           |        |       |           |       |
  modifyMinutesOfDate,                  //           |        |       |           |       |
  yearNow,                              //           |        |       |           |       |
  // file                               //           |        |       |           |       |
  prettyBytes,                          //           |        |       |           |       |
  // response                           //           |        |       |           |       |
  isValidHTTPStatus,                    //           |        |       |           |       |
                                        //           |        |       |           |       |
  // SERVICES                           //           |        |       |           |       |
  apiAnyRequest,                        //           |        |       |           |       |
  apiCreateOne,                         //           |        |       |           |       |
  apiDeleteOne,                         //           |        |       |           |       |
  apiFetchByIds,                        //           |        |       |           |       |
  apiFetchList,                         //           |        |       |           |       |
  apiFetchOne,                          //           |        |       |           |       |
  apiUpdateOne,                         //           |        |       |           |       |
  useQueryBuilder,                      //           |        |       |           |       |
  useJobApi,                            //           |        |       |           |       |
  useJobResource,                       //           |        |       |           |       |
  useJobStatus,                         //           |        |       |           |       |
  useAcl,                               //           |        |       |           |       |
                                        //           |        |       |           |       |
  // TRANSLATION                        //           |        |       |           |       |
  commonMessages,                       //           |        |       |           |       |
                                        //           |        |       |           |       |
  // SYMBOLS, CONSTANTS                 //           |        |       |           |       |
  SystemScopeSymbol, SubjectScopeSymbol,//           |        |       |           |       |
  HTTP_STATUS_OK,                       //           |        |       |           |       |
  HTTP_STATUS_CREATED,                  //           |        |       |           |       |
  HTTP_STATUS_NO_CONTENT,               //           |        |       |           |       |
  HTTP_STATUS_BAD_REQUEST,              //           |        |       |           |       |
  HTTP_STATUS_UNAUTHORIZED,             //           |        |       |           |       |
  HTTP_STATUS_UNPROCESSABLE_ENTITY,     //           |        |       |           |       |
  ROLE_SUPER_ADMIN,                     //           |        |       |           |       |
  NEW_LINE_MARK,                        //           |        |       |           |       |
                                        //           |        |       |           |       |
  // OTHER                              //           |        |       |           |       |
  AnzuApiResponseCodeError,             //           |        |       |           |       |
  AnzuApiValidationError,               //           |        |       |           |       |
  AnzuFatalError,                       //           |        |       |           |       |
  AnzuSystemsCommonAdmin,               //           |        |       |           |       |
  AclValue,                             //           |        |       |           |       |
  PluginOptions,                        //           |        |       |           |       |
}
/* eslint-enable */
