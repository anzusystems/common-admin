import { describe, expect, it, vi } from 'vitest'
import { createApp, isRef } from 'vue'
import AnzuSystemsCommonAdmin, {
  type CommonAdminCoreDamOptions,
  type CommonAdminImageOptions,
} from '@/AnzuSystemsCommonAdmin'
import {
  initCommonAdminImageOptions,
  useCommonAdminImageOptions,
} from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import {
  initCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptionsGlobal,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useCommonAdminCollabOptions } from '@/domains/collab/composables/commonAdminCollabOptions'
import { i18n } from '@/plugins/i18n'

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
    createApp({}).use(AnzuSystemsCommonAdmin, { i18n, languages: { available: ['sk'], default: 'sk' } })
    expect(useCommonAdminCollabOptions().collabOptions.value.enabled).toBe(false)
  })

  it('the options the plugin is installed with reach the composables', () => {
    createApp({}).use(AnzuSystemsCommonAdmin, {
      i18n,
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

// Without `i18n` the library translates through its own instance, which has no messages: every text
// renders as its key, and the per-key "missing translation" warnings do not say why.
describe('plugin without i18n', () => {
  it('says the option is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createApp({}).use(AnzuSystemsCommonAdmin, {
      languages: { available: ['sk'], default: 'sk' },
    } as unknown as Parameters<typeof AnzuSystemsCommonAdmin.install>[1])

    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain('i18n')
  })

  it('stays quiet with it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createApp({}).use(AnzuSystemsCommonAdmin, { i18n, languages: { available: ['sk'], default: 'sk' } })

    expect(warn).not.toHaveBeenCalled()
  })
})
