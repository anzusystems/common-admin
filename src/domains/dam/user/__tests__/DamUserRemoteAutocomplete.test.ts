import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ADamUserRemoteAutocomplete from '@/domains/dam/user/components/DamUserRemoteAutocomplete.vue'

// An admin that is not DAM lists DAM users through the DAM client its plugin options configure; a caller may name
// another client.

const used = vi.hoisted(() => ({ clients: [] as unknown[], configs: [] as string[] }))
const configured = vi.hoisted(() => () => ({ configured: true }))

vi.mock('@/domains/dam/user/composables/damUserSelectActions', () => ({
  useDamUserSelectAction: (client: unknown) => {
    used.clients.push(client)
    return { fetchItems: vi.fn(async () => []), fetchItemsByIds: vi.fn(async () => []) }
  },
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', () => ({
  useCommonAdminCoreDamOptions: (configName: string) => {
    used.configs.push(configName)
    return { damClient: configured }
  },
}))

const mountWith = async (props: Record<string, unknown>) => {
  used.clients.length = 0
  used.configs.length = 0
  const wrapper = mount(ADamUserRemoteAutocomplete, { props: { modelValue: null, ...props } })
  await nextTick()
  wrapper.unmount()
}

describe('ADamUserRemoteAutocomplete', () => {
  it('lists the users through the configured DAM client', async () => {
    await mountWith({ configName: 'cms' })
    expect(used.configs).toEqual(['cms'])
    expect(used.clients).toEqual([configured])
  })

  it('lists them through the given client instead', async () => {
    const client = () => ({ given: true })
    await mountWith({ client })
    expect(used.configs).toEqual([])
    expect(used.clients).toEqual([client])
  })
})
