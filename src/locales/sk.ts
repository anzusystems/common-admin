import alert from '@/locales/sk/common/alert.json'
import button from '@/locales/sk/common/button.json'
import model from '@/locales/sk/common/model.json'
import system from '@/locales/sk/common/system.json'
import anzuUser from '@/locales/sk/common/anzuUser.json'
import job from '@/locales/sk/common/job.json'
import log from '@/locales/sk/common/log.json'
import permission from '@/locales/sk/common/permission.json'
import permissionGroup from '@/locales/sk/common/permissionGroup.json'
import vuetify from '@/locales/sk/vuetify.json'
import apiValidation from '@/locales/sk/error/apiValidation.json'
import apiForbiddenOperation from '@/locales/sk/error/apiForbiddenOperation.json'
import jsValidation from '@/locales/sk/error/jsValidation.json'
import assetSelect from '@/locales/sk/common/assetSelect.json'
import subjectSelect from '@/locales/sk/common/subjectSelect.json'
import time from '@/locales/sk/common/time.json'
import sortable from '@/locales/sk/common/sortable.json'
import damImage from '@/locales/sk/common/damImage.json'

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
  },
  $vuetify: vuetify,
  error: {
    apiValidation: {
      ...apiValidation,
    },
    apiForbiddenOperation: {
      ...apiForbiddenOperation,
    },
    jsValidation: {
      ...jsValidation,
    },
  },
}
