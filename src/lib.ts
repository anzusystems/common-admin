import ABooleanValue from './components/ABooleanValue.vue'
import ARow from './components/ARow.vue'
import PermissionGrantEditor from '@/components/permission/PermissionGrantEditor.vue'
import PermissionValueChip from '@/components/permission/PermissionValueChip.vue'
import { commonMessages } from './locales'
import { setValueByPath, deletePropertyByPath, deepFreeze, simpleCloneObject, getValueByPath } from './utils/object'
import {
  isEmpty,
  isEmptyObject,
  isObject,
  isEmptyArray,
  isArray,
  isBoolean,
  isDocId,
  isNull,
  isNotUndefined,
  isUndefined,
  isInt,
  isString,
  isNumber,
} from './utils/common'
import { toInt, slugify, toFloat, splitOnFirstOccurrence, trimLength } from './utils/string'
import {
  currentTimestamp,
  DATETIME_MAX,
  DATETIME_MIN,
  dateTimeEndOfDay,
  dateTimeStartOfDay,
  dateTimeNow,
  friendlyDateTime,
  newDateNow,
  prettyDateTime,
  dateToUtc,
  modifyMinutesOfDate,
  yearNow,
} from './utils/datetime'
import { Grant, useGrant } from '@/model/valueObject/Grant'
import { GrantOrigin, useGrantOrigin } from '@/model/valueObject/GrantOrigin'
import { useAnzuUserFactory } from '@/model/factory/AnzuUserFactory'

import type {
  IntegerId,
  DatetimeUTC,
  DatetimeUTCNullable,
  DocId,
  DocIdNullable,
  IntegerIdNullable,
} from '@/types/common'
import type { Filter, FilterBag, FilterVariant } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'
import type { OwnerAware } from '@/types/OwnerAware'
import { isOwnerAware } from '@/types/OwnerAware'
import type { AnzuUserAndTimeTrackingAware, AnzuUserCreatedByAware, AnzuUser } from '@/types/AnzuUser'
import { isAnzuUserCreatedByAware } from '@/types/AnzuUser'
import type { ValueObjectOption } from '@/types/ValueObject'

/* eslint-disable */
// ITEM ------------------------------------- FORUM --- BLOG --- DAM --- INHOUSE --- CMS ---
export {                                //           |        |       |           |       |
  // COMPONENTS                         //           |        |       |           |       |
  ARow,                                 //           |        |       |           |       |
  ABooleanValue,                        //           |        |       |           |       |
  PermissionGrantEditor,                //           |        |       |           |       |
  PermissionValueChip,                  //           |        |       |           |       |
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
  AnzuUserCreatedByAware,               //           |        |       |           |       |
  AnzuUserAndTimeTrackingAware,         //           |        |       |           |       |
  isAnzuUserCreatedByAware,             //           |        |       |           |       |
  ValueObjectOption,                    //           |        |       |           |       |
  Pagination,                           //           |        |       |           |       |
  OwnerAware,                           //           |        |       |           |       |
  isOwnerAware,                         //           |        |       |           |       |
  Filter,                               //           |        |       |           |       |
  FilterBag,                            //           |        |       |           |       |
  FilterVariant,                        //           |        |       |           |       |
                                        //           |        |       |           |       |
  // Factories                          //           |        |       |           |       |
  useAnzuUserFactory,                   //           |        |       |           |       |
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
                                        //           |        |       |           |       |
  // TRANSLATION                        //           |        |       |           |       |
  commonMessages                        //           |        |       |           |       |
}
/* eslint-enable */
