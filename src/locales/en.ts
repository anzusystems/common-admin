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
import validationApi from '@/locales/en/validation/api.json'
import validationJs from '@/locales/en/validation/js.json'

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
  },
  $vuetify: vuetify,
  validations: {
    api: {
      ...validationApi,
    },
    js: {
      ...validationJs,
    },
  },
}
