import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'

vi.mock('@/components/damImage/uploadQueue/composables/damConfigApi', () => ({
  fetchPubConfiguration: vi.fn(async () => ({ userAuthType: 'json_credentials' })),
  fetchConfiguration: vi.fn(async () => ({
    settings: {},
    colorSet: {},
    assetExternalProviders: {},
    distributionServices: {},
  })),
  fetchExtSystemConfiguration: vi.fn(),
}))

describe('useDamConfigState flags', () => {
  it('loading the private config leaves the public one loaded', async () => {
    setActivePinia(createPinia())
    const store = useDamConfigStore()
    const { loadDamPubConfig, loadDamPrvConfig } = useDamConfigState(() => ({}) as AxiosInstance)

    await loadDamPubConfig()
    expect(store.initialized.damPubConfig).toBe(true)

    await loadDamPrvConfig()
    expect(store.initialized.damPrvConfig).toBe(true)
    expect(store.initialized.damPubConfig).toBe(true)
  })
})
