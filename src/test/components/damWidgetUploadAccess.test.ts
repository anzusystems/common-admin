import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AImageWidget from '@/components/damImage/AImageWidget.vue'
import {
  filterAllowedImageWidgetSelectConfigs,
  isImageWidgetUploadConfigAllowed,
} from '@/components/damImage/composables/damFilterUserAllowedUploadConfigs'
import { useAuthStore } from '@/composables/auth/authStore'
import { SYSTEM_DAM } from '@/components/damImage/uploadQueue/api/damConstants'

// admin-cms lets the app in when the DAM user fails to load ("features will not work correctly"):
// the widgets must then refuse, as the select configs already do, not offer an upload DAM rejects.
vi.mock('@/components/damImage/uploadQueue/composables/damConfigState', () => ({
  useDamConfigState: () => ({
    getDamConfigExtSystem: () => undefined,
    loadDamPrvConfig: async () => undefined,
    loadDamConfigAssetCustomFormElements: async () => true,
    getDamConfigAssetCustomFormElements: () => ({ image: [], audio: [], video: [], document: [] }),
    getOrLoadDamConfigExtSystemByLicence: async (licence: number) => ({
      licence,
      extSystem: 1,
      licenceName: '',
      extSystemConfig: {},
    }),
    getOrLoadDamConfigExtSystemByLicences: async () => [],
  }),
}))
vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
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
    const user = { id: 1, roles: [], adminToExtSystems: [], resolvedAssetLicences: [] as { id: number }[] }
    setDamUser(user)
    expect(isImageWidgetUploadConfigAllowed(config)).toBe(false)
    user.resolvedAssetLicences = [{ id: 10 }]
    expect(isImageWidgetUploadConfigAllowed(config)).toBe(true)
    setDamUser({ ...user, adminToExtSystems: [1], resolvedAssetLicences: [] })
    expect(isImageWidgetUploadConfigAllowed(config)).toBe(true)
  })
})

describe('AImageWidget without a DAM user', () => {
  it('shows the access rights error instead of the widget', async () => {
    const wrapper = mount(AImageWidget, {
      props: { modelValue: null, queueKey: 'q', uploadLicence: 10, selectLicences: [10] },
      global: { stubs: { ImageWidgetInner: true } },
    })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ImageWidgetInner' }).exists()).toBe(false)
    expect(wrapper.text()).toContain('Media Library access rights error')
    wrapper.unmount()
  })
})
