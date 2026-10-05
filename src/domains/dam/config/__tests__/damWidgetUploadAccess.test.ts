import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import AImageMediaWidget from '@/domains/dam/imageWidget/components/AImageMediaWidget.vue'
import {
  filterAllowedImageWidgetSelectConfigs,
  isImageWidgetUploadConfigAllowed,
} from '@/domains/dam/config/utils/damFilterUserAllowedUploadConfigs'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { SYSTEM_DAM } from '@/domains/dam/api/damConstants'

// admin-cms lets the app in when the DAM user fails to load ("features will not work correctly"):
// the widgets must then refuse, as the select configs already do, not offer an upload DAM rejects.
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({
    getDamConfigExtSystem: () => undefined,
    loadDamPrvConfig: async () => undefined,
    loadDamConfigAssetCustomFormElements: async () => true,
    getDamConfigAssetCustomFormElements: () => ({ image: [], audio: [], video: [], document: [] }),
    // Licence 99 stands for one the backend refuses to the user: its config does not load.
    getOrLoadDamConfigExtSystemByLicence: async (licence: number) =>
      licence === 99 ? undefined : { licence, extSystem: 1, licenceName: '', extSystemConfig: {} },
    getOrLoadDamConfigExtSystemByLicences: async () => [],
  }),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}) }),
}))

const config = { licence: 10, extSystem: 1, licenceName: '', extSystemConfig: {} } as never

const setDamUser = (user: object) => {
  useAuthStore().currentUsers.value.set(SYSTEM_DAM, user as never)
  useAuthStore().currentUsersLoaded.value.set(SYSTEM_DAM, true)
}

afterEach(() => useAuthStore().reset())

describe('isImageWidgetUploadConfigAllowed', () => {
  it('refuses when the DAM user is not loaded, like the select configs filter', () => {
    expect(filterAllowedImageWidgetSelectConfigs([config])).toEqual([])
    expect(isImageWidgetUploadConfigAllowed(config)).toBe(false)
  })

  it('allows by ext system admin or by licence, refuses otherwise', () => {
    const user = {
      id: 1,
      roles: [],
      adminToExtSystems: [] as number[],
      userToExtSystems: [] as number[],
      resolvedAssetLicences: [] as { id: number }[],
    }
    setDamUser(user)
    expect(isImageWidgetUploadConfigAllowed(config)).toBe(false)
    user.resolvedAssetLicences = [{ id: 10 }]
    expect(isImageWidgetUploadConfigAllowed(config)).toBe(true)
    setDamUser({ ...user, adminToExtSystems: [1], resolvedAssetLicences: [] })
    expect(isImageWidgetUploadConfigAllowed(config)).toBe(true)
  })

  it('allows a user of the ext system, as the backend licence voter does', () => {
    setDamUser({ id: 1, roles: [], adminToExtSystems: [], userToExtSystems: [1], resolvedAssetLicences: [] })
    expect(isImageWidgetUploadConfigAllowed(config)).toBe(true)
    expect(filterAllowedImageWidgetSelectConfigs([config])).toHaveLength(1)
  })
})

describe('AImageWidget without a DAM user', () => {
  it('shows the image read-only instead of offering an upload DAM rejects', async () => {
    const wrapper = mount(AImageWidget, {
      props: { modelValue: null, queueKey: 'q', uploadLicence: 10, selectLicences: [10] },
      global: { stubs: { ImageWidgetInner: true } },
    })
    await flushPromises()
    const inner = wrapper.findComponent({ name: 'ImageWidgetInner' })
    expect(inner.exists()).toBe(true)
    expect(inner.props('readonly')).toBe(true)
    wrapper.unmount()
  })
})

describe('AImageWidget whose licence config does not load', () => {
  it('still shows the image, read-only, with the error', async () => {
    const wrapper = mount(AImageWidget, {
      props: { modelValue: 5, queueKey: 'q', uploadLicence: 99, selectLicences: [99] },
      global: { stubs: { ImageWidgetInner: true, AImageWidgetSimple: true } },
    })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ImageWidgetInner' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'AImageWidgetSimple' }).props('modelValue')).toBe(5)
    expect(wrapper.find('.text-error').exists()).toBe(true)
    wrapper.unmount()
  })

  it('still shows a stored audio or video, read-only, in the media widget', async () => {
    const media = { id: 3, damMedia: { imageFileId: null, playable: true, assetType: 'video' } }
    const wrapper = mount(AImageMediaWidget, {
      props: { media, image: null, queueKey: 'q', uploadLicence: 99, selectLicences: [99] } as never,
      global: { stubs: { ImageMediaWidgetInner: true, AMediaWidgetSimple: true, AImageWidgetSimple: true } },
    })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'AMediaWidgetSimple' }).props('media')).toEqual(media)
    expect(wrapper.findComponent({ name: 'AImageWidgetSimple' }).exists()).toBe(false)
    wrapper.unmount()
  })
})
