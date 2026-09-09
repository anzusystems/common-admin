import alert from '@/locales/en/common/alert.json'
import button from '@/locales/en/common/button.json'
import model from '@/locales/en/common/model.json'
import system from '@/locales/en/common/system.json'
import anzuUser from '@/locales/en/common/anzuUser.json'
import job from '@/locales/en/common/job.json'
import log from '@/locales/en/common/log.json'
import permission from '@/locales/en/common/permission.json'
import permissionGroup from '@/locales/en/common/permissionGroup.json'
import vuetify from '@/locales/en/vuetify.json'
import apiValidation from '@/locales/en/error/apiValidation.json'
import apiForbiddenOperation from '@/locales/en/error/apiForbiddenOperation.json'
import apiDependencyExists from '@/locales/en/error/apiDependencyExists.json'
import jsValidation from '@/locales/en/error/jsValidation.json'
import assetSelect from '@/locales/en/common/assetSelect.json'
import subjectSelect from '@/locales/en/common/subjectSelect.json'
import time from '@/locales/en/common/time.json'
import sortable from '@/locales/en/common/sortable.json'
import damImage from '@/locales/en/common/damImage.json'
import customFormElement from '@/locales/en/common/customFormElement.json'
import customForm from '@/locales/en/common/customForm.json'
import confirmDialog from '@/locales/en/common/confirmDialog.json'
import linkDto from '@/locales/en/common/linkDto.json'
import listItemDto from '@/locales/en/common/listItemDto.json'
import dayOfWeek from '@/locales/en/common/dayOfWeek.json'
import collab from '@/locales/en/common/collab.json'
import filter from '@/locales/en/common/filter.json'
import apiTimedOut from '@/locales/en/error/apiTimedOut.json'

export default {
  common: {
    alert,
    button,
    model,
    system,
    anzuUser,
    job,
    log,
    permission,
    permissionGroup,
    assetSelect,
    subjectSelect,
    time,
    sortable,
    damImage,
    customFormElement,
    customForm,
    confirmDialog,
    linkDto,
    listItemDto,
    dayOfWeek,
    collab,
    filter,
  },
  $vuetify: vuetify,
  error: {
    apiValidation: {
      ...apiValidation,
    },
    apiForbiddenOperation: {
      ...apiForbiddenOperation,
    },
    apiDependencyExists: {
      ...apiDependencyExists,
    },
    jsValidation: {
      ...jsValidation,
    },
    apiTimedOut: {
      ...apiTimedOut,
    },
  },
}
