import { describe, expect, it } from 'vitest'
import { createApp, isRef } from 'vue'
import AnzuSystemsCommonAdmin, {
  type CommonAdminCoreDamOptions,
  type CommonAdminImageOptions,
} from '@/AnzuSystemsCommonAdmin'
import {
  initCommonAdminImageOptions,
  useCommonAdminImageOptions,
} from '@/components/damImage/composables/commonAdminImageOptions'
import {
  initCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptionsGlobal,
} from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'

// The plugin writes its options into module state that the DAM, image and collab composables read
// later, from other chunks. The module state lives as long as the file, so the cases run in order:
// first nothing is configured, then the plugin is installed.

const imageOptions = {
  configs: {
    default: {
      imageClient: () => ({}) as never,
      previewDomain: 'https://img',
      previewDomainOriginal: 'https://orig',
      width: 800,
      height: 450,
    },
  },
} as unknown as CommonAdminImageOptions

const coreDamOptions = {
  configs: { default: { damClient: () => ({}) as never } },
  apiTimeout: 7,
  uploadStatusFallback: false,
  notification: { enabled: false, webSocketUrl: '' },
  adminDomain: 'https://dam',
} as unknown as CommonAdminCoreDamOptions

describe('plugin options', () => {
  const collabRefBeforeInstall = useCommonAdminCollabOptions().collabOptions

  it('image and coreDam composables throw until the plugin is configured', () => {
    expect(() => useCommonAdminImageOptions()).toThrow()
    expect(() => useCommonAdminCoreDamOptions()).toThrow()
    expect(() => useCommonAdminCoreDamOptionsGlobal()).toThrow()
  })

  it('collab is off until configured', () => {
    const { collabOptions } = useCommonAdminCollabOptions()
    expect(isRef(collabOptions)).toBe(true)
    expect(collabOptions.value.enabled).toBe(false)
  })

  it('collab keeps its default when the plugin gets no collab options', () => {
    createApp({}).use(AnzuSystemsCommonAdmin, { languages: { available: ['sk'], default: 'sk' } })
    expect(useCommonAdminCollabOptions().collabOptions.value.enabled).toBe(false)
  })

  it('the options the plugin is installed with reach the composables', () => {
    createApp({}).use(AnzuSystemsCommonAdmin, {
      languages: { available: ['sk'], default: 'sk' },
      image: imageOptions,
      coreDam: coreDamOptions,
      collab: { enabled: true, socketUrl: 'wss://collab', beforeReconnect: () => Promise.resolve(), io: undefined },
    })
    expect(useCommonAdminImageOptions().previewDomain).toBe('https://img')
    expect(useCommonAdminCoreDamOptions().endPointImage).toBe('/adm/v1/image')
    expect(useCommonAdminCoreDamOptionsGlobal().apiTimeout).toBe(7)
    expect(useCommonAdminCollabOptions().collabOptions.value.socketUrl).toBe('wss://collab')
  })

  it('every caller shares one collab options ref, the one the plugin writes', () => {
    const now = useCommonAdminCollabOptions().collabOptions
    expect(now).toBe(collabRefBeforeInstall)
    expect(collabRefBeforeInstall.value.socketUrl).toBe('wss://collab')
  })

  it('the init functions stay reachable from the area modules', () => {
    initCommonAdminCoreDamOptions({ ...coreDamOptions, adminDomain: 'https://dam2' } as CommonAdminCoreDamOptions)
    expect(useCommonAdminCoreDamOptionsGlobal().adminDomain).toBe('https://dam2')
    initCommonAdminImageOptions(imageOptions)
    expect(useCommonAdminImageOptions().imageWidth).toBe(800)
  })
})
