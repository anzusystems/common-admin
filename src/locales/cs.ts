import alert from '@/locales/cs/common/alert.json'
import button from '@/locales/cs/common/button.json'
import model from '@/locales/cs/common/model.json'
import system from '@/locales/cs/common/system.json'
import anzuUser from '@/locales/cs/common/anzuUser.json'
import job from '@/locales/cs/common/job.json'
import log from '@/locales/cs/common/log.json'
import permission from '@/locales/cs/common/permission.json'
import permissionGroup from '@/locales/cs/common/permissionGroup.json'
import vuetify from '@/locales/cs/vuetify.json'
import apiValidation from '@/locales/cs/error/apiValidation.json'
import apiForbiddenOperation from '@/locales/cs/error/apiForbiddenOperation.json'
import apiDependencyExists from '@/locales/cs/error/apiDependencyExists.json'
import jsValidation from '@/locales/cs/error/jsValidation.json'
import assetSelect from '@/locales/cs/common/assetSelect.json'
import subjectSelect from '@/locales/cs/common/subjectSelect.json'
import time from '@/locales/cs/common/time.json'
import sortable from '@/locales/cs/common/sortable.json'
import damImage from '@/locales/cs/common/damImage.json'
import customFormElement from '@/locales/cs/common/customFormElement.json'
import customForm from '@/locales/cs/common/customForm.json'
import confirmDialog from '@/locales/cs/common/confirmDialog.json'
import linkDto from '@/locales/cs/common/linkDto.json'
import listItemDto from '@/locales/cs/common/listItemDto.json'
import dayOfWeek from '@/locales/cs/common/dayOfWeek.json'
import collab from '@/locales/cs/common/collab.json'
import filter from '@/locales/cs/common/filter.json'
import routeSettings from '@/locales/cs/common/routeSettings.json'
import apiTimedOut from '@/locales/cs/error/apiTimedOut.json'

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
    routeSettings,
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
