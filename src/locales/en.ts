import vuetify from '@/locales/en/vuetify.json'
import alert from '@/locales/en/common/alert.json'
import button from '@/locales/en/common/button.json'
import model from '@/locales/en/common/model.json'
import system from '@/locales/en/common/system.json'
import anzuUser from '@/locales/en/common/anzuUser.json'
import job from '@/locales/en/common/job.json'
import log from '@/locales/en/common/log.json'
import permission from '@/locales/en/common/permission.json'
import permissionGroup from '@/locales/en/common/permissionGroup.json'
import apiValidation from '@/locales/en/error/apiValidation.json'
import jsValidation from '@/locales/en/error/jsValidation.json'
import apiForbiddenOperation from '@/locales/en/error/apiForbiddenOperation.json'
import assetSelect from '@/locales/en/common/assetSelect.json'

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
