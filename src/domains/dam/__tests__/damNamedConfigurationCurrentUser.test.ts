import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam, type FakeDamRequest } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { seedDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import {
  alertText,
  forgetAlerts,
  shownAlerts,
  signInToDam,
  signOutOfDam,
} from '@/domains/dam/__tests__/support/uploadUi'
import AAssetListInner from '@/domains/dam/assetSelect/components/AAssetListInner.vue'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import {
  filterAllowedImageWidgetSelectConfigs,
  isImageWidgetUploadConfigAllowed,
} from '@/domains/dam/config/utils/damFilterUserAllowedUploadConfigs'
import AImageMediaWidget from '@/domains/dam/imageWidget/components/AImageMediaWidget.vue'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import AImageWidgetMultiple from '@/domains/dam/imageWidget/components/AImageWidgetMultiple.vue'
import { initCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { DamAssetType } from '@/domains/dam/types/Asset'

const { endPoints, extSystem, licence } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }

let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined

const isListRequest = (of: FakeDam) => (request: FakeDamRequest) =>
  request.method === 'GET' && request.url.startsWith(`${of.endPoints.asset}/licence/${licence}/search?`)

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  for (const of of [dam, own]) {
    of.reply((request) => (isListRequest(of)(request) ? { status: 200, data: { data: [], totalCount: 0 } } : undefined))
  }
  const { coreDam, image } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam!,
    configs: {
      ...coreDam!.configs,
      own: { damClient: own.client, endPointAsset: OWN.asset, endPointImage: OWN.image, currentUser: 'x' },
      open: { damClient: dam.client, currentUser: false },
      ofCms: { damClient: dam.client, currentUser: 'cms' },
    },
  })
  const imageOfDefault = image!.configs.default!
  initCommonAdminImageOptions({
    ...image!,
    configs: { ...image!.configs, own: imageOfDefault, open: imageOfDefault, ofCms: imageOfDefault },
  })
  seedDamConfigOf('own', pinia)
  seedDamConfigOf('open', pinia)
  seedDamConfigOf('ofCms', pinia)
  signInToDam(extSystem)
  const auth = useAuthStore()
  auth.currentUsers.value.set('x', {
    id: 2,
    roles: [],
    resolvedPermissions: {},
    adminToExtSystems: [],
    userToExtSystems: [],
    resolvedAssetLicences: [],
  } as never)
  auth.currentUsersLoaded.value.set('x', true)
  waits = holdLongWaits()
  forgetAlerts()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  waits.restore()
  signOutOfDam()
  forgetAlerts()
})

const listStubs = Object.fromEntries(
  [
    'AssetSelectListBar',
    'AssetSelectListTiles',
    'AssetSelectListTable',
    'AssetMetadata',
    'AssetDetailDialog',
    'UploadQueueEditable',
    'AssetSelectFilter',
    'AssetSelectFilterForm',
  ].map((name) => [name, true])
)

const configOfLicence = () => ({
  licence,
  extSystem,
  licenceName: 'licence',
  extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
})

describe('the licences of a DAM configuration', () => {
  it.each([
    ['default', true],
    ['own', false],
  ] as const)('are those its current user may use: under %s, allowed %s', (configName, allowed) => {
    expect(isImageWidgetUploadConfigAllowed(configOfLicence(), configName)).toBe(allowed)
    expect(filterAllowedImageWidgetSelectConfigs([configOfLicence()], configName)).toHaveLength(allowed ? 1 : 0)
  })

  it('are all of them under a configuration that names no current user, also with no user loaded', () => {
    signOutOfDam()

    expect(isImageWidgetUploadConfigAllowed(configOfLicence(), 'open')).toBe(true)
    expect(filterAllowedImageWidgetSelectConfigs([configOfLicence()], 'open')).toHaveLength(1)
    expect(isImageWidgetUploadConfigAllowed(configOfLicence(), 'default')).toBe(false)
  })

  const widgets: Array<[string, Component, string, Record<string, unknown>]> = [
    ['the image widget', AImageWidget, 'ImageWidgetInner', { modelValue: null }],
    ['the widget of several images', AImageWidgetMultiple, 'ImageWidgetMultipleInner', { modelValue: [] }],
    ['the image and media widget', AImageMediaWidget, 'ImageMediaWidgetInner', { image: null, media: null }],
  ]

  it.each(widgets)(
    'make %s read-only under a configuration whose user may not upload',
    async (_name, widget, inner, props) => {
      const readonlyUnder = async (configName: string) => {
        wrapper = mount(widget, {
          props: { queueKey: 'q', uploadLicence: licence, selectLicences: [licence], configName, ...props } as never,
          global: { plugins: [pinia], stubs: { [inner]: true } },
        })
        await flushPromises()
        const readonly = wrapper.findComponent({ name: inner }).props('readonly')
        wrapper.unmount()
        wrapper = undefined
        return readonly
      }

      expect(await readonlyUnder('own')).toBe(true)
      expect(await readonlyUnder('default')).toBe(false)
      expect(await readonlyUnder('open')).toBe(false)
    }
  )

  // A user of a system that is not a DAM user: an admin of it is no admin of DAM, and nothing is read of its licences.
  // The error is logged, the widget is read-only and the list says the licence is not allowed.
  it.each([
    ['an admin of that system', ['ROLE_SUPER_ADMIN']],
    ['a user of that system', []],
  ])('allow no licence under a configuration whose current user is %s, not of DAM', async (_name, roles) => {
    const auth = useAuthStore()
    auth.currentUsers.value.set('cms', { id: 3, roles, resolvedPermissions: {} } as never)
    auth.currentUsersLoaded.value.set('cms', true)
    auth.isAdminRoleBySystem.value.set('cms', 'ROLE_SUPER_ADMIN')
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(isImageWidgetUploadConfigAllowed(configOfLicence(), 'ofCms')).toBe(false)
    expect(filterAllowedImageWidgetSelectConfigs([configOfLicence()], 'ofCms')).toEqual([])
    wrapper = mount(AImageWidget, {
      props: {
        modelValue: null,
        queueKey: 'q',
        uploadLicence: licence,
        selectLicences: [licence],
        configName: 'ofCms',
      },
      global: { plugins: [pinia], stubs: { ImageWidgetInner: true } },
    })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ImageWidgetInner' }).props('readonly')).toBe(true)
    wrapper.unmount()
    wrapper = mount(AAssetListInner, {
      attachTo: document.body,
      props: { assetType: DamAssetType.Image, queueKey: 'q', selectConfigs: [configOfLicence()], configName: 'ofCms' },
      global: { plugins: [pinia], stubs: listStubs },
    })
    await flushPromises()

    expect(shownAlerts()).toEqual([['error', alertText('common.assetSelect.error.unallowedLicence')]])
    expect(dam.requests.filter(isListRequest(dam))).toEqual([])
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('"cms"'))
    logged.mockRestore()
  })

  it.each([
    ['own', false, 'refuses'],
    ['own', true, 'lists'],
    ['default', false, 'lists'],
  ] as const)(
    'are what the asset list under %s with skipCurrentUserCheck %s offers: it %s',
    async (configName, skip, does) => {
      const of = configName === 'own' ? own : dam
      wrapper = mount(AAssetListInner, {
        attachTo: document.body,
        props: {
          assetType: DamAssetType.Image,
          queueKey: 'q',
          selectConfigs: [configOfLicence()],
          skipCurrentUserCheck: skip,
          configName,
        } as never,
        global: { plugins: [pinia], stubs: listStubs },
      })
      await flushPromises()

      if (does === 'refuses') {
        expect(shownAlerts()).toEqual([['error', alertText('common.assetSelect.error.unallowedLicence')]])
        expect(of.requests.filter(isListRequest(of))).toEqual([])
        return
      }
      await vi.waitFor(() => expect(of.requests.filter(isListRequest(of))).toHaveLength(1))
      expect(shownAlerts()).toEqual([])
    }
  )
})
