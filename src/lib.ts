import ABooleanValue from './components/ABooleanValue.vue'
import ARow from './components/ARow.vue'
import { commonMessages } from './locales'
import { setValueByPath, deletePropertyByPath, deepFreeze, simpleCloneObject, getValueByPath } from './utils/object'
import { isEmpty, isEmptyObject, isObject, isEmptyArray, isArray, isBoolean, isDocId, isNull, isNotUndefined, isUndefined, isInt, isString, isNumber } from './utils/common'

export {
  // COMPONENTS
  ARow,
  ABooleanValue,

  // UTILS
  // common
  isEmpty, isEmptyObject, isObject, isEmptyArray, isArray, isBoolean, isDocId, isNull, isNotUndefined, isUndefined, isInt, isString, isNumber,
  // object
  setValueByPath, deletePropertyByPath, deepFreeze, simpleCloneObject, getValueByPath,

// TRANSLATION
  commonMessages
}
