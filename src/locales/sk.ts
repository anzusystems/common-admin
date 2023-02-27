import alert from '@/locales/sk/common/alert.json'
import button from '@/locales/sk/common/button.json'
import model from '@/locales/sk/common/model.json'
import system from '@/locales/sk/common/system.json'
import anzuUser from '@/locales/sk/common/anzuUser.json'
import job from '@/locales/sk/common/job.json'
import log from '@/locales/sk/common/log.json'
import permission from '@/locales/sk/common/permission.json'
import permissionGroup from '@/locales/sk/common/permissionGroup.json'
import validationApi from '@/locales/sk/validation/api.json'
import validationJs from '@/locales/sk/validation/js.json'
import vuetify from '@/locales/sk/vuetify.json'

export const sk = {
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
  ...vuetify,
  validations: {
    api: {
      ...validationApi,
    },
    js: {
      ...validationJs,
    },
  },
}
