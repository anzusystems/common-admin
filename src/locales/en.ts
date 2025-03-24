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
import apiDependencyExists from '@/locales/en/error/apiDependencyExists.json'
import assetSelect from '@/locales/en/common/assetSelect.json'
import subjectSelect from '@/locales/en/common/subjectSelect.json'
import time from '@/locales/en/common/time.json'
import sortable from '@/locales/en/common/sortable.json'
import damImage from '@/locales/en/common/damImage.json'
import collab from '@/locales/en/common/collab.json'

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
    collab,
  },
  system: {
    subject: {
      filter: {
        id: 'Systémové Id',
        discriminator: 'Typ',
        headline: 'Headline',
        docId: 'Id',
        version: 'Verzia',
        text: 'Fulltext',
        title: 'Názov',
        site: 'Web',
        rubric: 'Rubriky',
        status: 'Status',
        desks: 'Desk/Tím',
        publicPublishedAtFrom: 'Zverejnené od',
        publicPublishedAtUntil: 'Zverejnené do',
        modifiedAtFrom: 'Upravené od',
        modifiedAtUntil: 'Upravené do',
        articleType: 'Typ',
        owners: 'Vlastníci',
        keywords: 'Kľúčové slová',
        articleAuthors: 'Autori',
        url: 'Url',
        lockType: 'Typ zámku',
        enableAds: 'Enable ads',
      },
      subjectStatus: {
        draft: 'Draft',
        ready: 'Ready',
        published: 'Published',
      },
      subjectLockType: {
        free: 'Neplatený článok',
        locked: 'Platený článok',
      },
    },
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
  },
}
