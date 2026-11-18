import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { SYSTEM_DAM } from '@/domains/dam/api/damConstants'
import { useAssetSelectPresetControl } from '@/domains/dam/assetSelect/composables/assetSelectPresetControl'
import { assetSelectPresetStorageKey } from '@/domains/dam/assetSelect/composables/assetSelectPresets'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import type { DamCurrentUserDto } from '@/domains/dam/types/DamCurrentUser'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import type { IntegerId } from '@/shared/types/common'

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ currentUser: 'dam' }),
}))

const SELECT_LICENCES: IntegerId[] = [10, 20]
const LIST_VIEWS: IntegerId[] = [1]

let pinia: Pinia

const setDamUser = (id: IntegerId) => {
  const { useCurrentUser } = defineAuth(SYSTEM_DAM)
  useCurrentUser<DamCurrentUserDto>(SYSTEM_DAM).setCurrentUser({
    id,
    roles: [],
    listViews: [{ id: 1, name: 'Šport a regióny', extSystem: 1, licences: [10, 30], uploadLicence: null }],
  } as unknown as DamCurrentUserDto)
}

const selectConfigs = (selectLicences: IntegerId[]) =>
  selectLicences.map(
    (licence) =>
      ({
        licence,
        extSystem: 1,
        licenceName: `Licencia ${licence}`,
      }) as unknown as DamConfigLicenceExtSystemReturnType
  )

const mountControl = async (selectLicences: IntegerId[] = SELECT_LICENCES) => {
  let control!: ReturnType<typeof useAssetSelectPresetControl>
  let store!: ReturnType<typeof useAssetSelectStore>
  mount(
    defineComponent({
      setup() {
        store = useAssetSelectStore()
        store.setSelectConfig(selectConfigs(selectLicences))
        control = useAssetSelectPresetControl(LIST_VIEWS, 'default')
        return () => h('div')
      },
    }),
    { global: { plugins: [pinia] } }
  )
  await flushPromises()
  return { control, store }
}

describe('useAssetSelectPresetControl', () => {
  beforeEach(() => {
    pinia = createPinia()
    localStorage.clear()
    setDamUser(1)
  })
  afterEach(() => {
    useAuthStore().reset()
  })

  it.each<[string, string | null, string, IntegerId[]]>([
    ['nothing remembered', null, 'licence:10', [10]],
    ['remembered list view', 'listView:1', 'listView:1', [10]],
    ['remembered single licence', 'licence:20', 'licence:20', [20]],
    ['remembered key this host does not offer', 'listView:9', 'licence:10', [10]],
  ])('opens on the right selection for %s', async (_name, storedKey, expectedKey, expectedLicenceIds) => {
    if (storedKey) {
      localStorage.setItem(assetSelectPresetStorageKey(1, SELECT_LICENCES, LIST_VIEWS), storedKey)
    }

    const { control, store } = await mountControl()

    expect(control.selectedPresetKey.value).toBe(expectedKey)
    expect(store.selectedLicenceIds).toEqual(expectedLicenceIds)
  })

  it.each<[string, IntegerId[], boolean]>([
    ['two licences', [10, 20], true],
    ['one licence in a list view of the user', [10], true],
    ['one licence outside every list view of the user', [20], false],
  ])('offers the selection only with more than one choice: %s', async (_name, selectLicences, expected) => {
    const { control } = await mountControl(selectLicences)

    expect(control.showPresets.value).toBe(expected)
  })

  it('groups the list views and the licences under their headers', async () => {
    const { control } = await mountControl()

    expect(control.items.value).toEqual([
      { type: 'subheader', title: 'Selections' },
      { value: 'listView:1', title: 'Šport a regióny' },
      { type: 'subheader', title: 'Licences' },
      { value: 'licence:10', title: 'Licencia 10' },
      { value: 'licence:20', title: 'Licencia 20' },
    ])
  })

  it('leaves the first licence choice to the preset control', () => {
    const store = useAssetSelectStore(pinia)

    store.setSelectConfig(selectConfigs(SELECT_LICENCES))

    expect(store.selectedLicenceIds).toEqual([])
  })

  it('reopens a closed picker on the chosen selection', async () => {
    const { control, store } = await mountControl()
    control.applyPreset('licence:20')
    // useStorage writes the choice in a watcher.
    await flushPromises()
    store.reset(true)

    const { control: reopened, store: reopenedStore } = await mountControl()

    expect(reopened.selectedPresetKey.value).toBe('licence:20')
    expect(reopenedStore.selectedLicenceIds).toEqual([20])
  })

  it('starts another DAM user in the same browser on the first licence', async () => {
    const { control } = await mountControl()
    control.applyPreset('licence:20')
    await flushPromises()
    pinia = createPinia()
    setDamUser(2)

    const { control: nextUser } = await mountControl()

    expect(nextUser.selectedPresetKey.value).toBe('licence:10')
  })

  it('starts on the first licence after the host licences change', async () => {
    const { control } = await mountControl()
    control.applyPreset('licence:20')
    await flushPromises()
    pinia = createPinia()

    const { control: changed } = await mountControl([10, 20, 30])

    expect(changed.selectedPresetKey.value).toBe('licence:10')
  })

  it('remembers nothing without a DAM user', async () => {
    useAuthStore().reset()

    const { control, store } = await mountControl()
    control.applyPreset('licence:20')
    await flushPromises()

    expect(store.selectedLicenceIds).toEqual([20])
    expect(localStorage.length).toBe(0)
  })
})
