import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, shallowRef } from 'vue'
import ImageWidgetMultipleInner from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleInner.vue'
import { ImageWidgetUploadConfigKey } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import { useUploadQueueDialog } from '@/components/damImage/uploadQueue/composables/uploadQueueDialog'
import type { DamImageCopyToLicenceResponseItem } from '@/types/coreDam/Asset'

// Copying several assets to the widget's licence: the refused ones are one message, and with
// nothing copied there is no queue to show.
const copyToLicence = vi.hoisted(() => vi.fn())
const showErrorT = vi.hoisted(() => vi.fn())
vi.mock('@/components/damImage/uploadQueue/api/damImageApi', () => ({
  fetchImageFile: vi.fn(),
  imageUploadStart: vi.fn(),
  imageUploadChunk: vi.fn(),
  imageUploadFinish: vi.fn(),
  rotateImage: vi.fn(),
  copyToLicence,
}))
vi.mock('@/composables/system/alerts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/composables/system/alerts')>()
  return { ...original, useAlerts: () => ({ ...original.useAlerts(), showErrorT }) }
})
vi.mock('@/components/damImage/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({ imageClient: () => ({}), imageApi: {} }),
}))
vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset', showSourceEnabled: true }),
}))
vi.mock('@/components/damImage/uploadQueue/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => undefined, getExtSystemByLicence: async () => 1 }),
}))

const AssetSelect = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })

const result = (asset: string, value: DamImageCopyToLicenceResponseItem['result']) => ({
  asset,
  targetAsset: `target-${asset}`,
  targetMainFile: `file-${asset}`,
  targetAssetLicence: 2,
  result: value,
  assetConflicts: [],
})

const confirmCopy = async (answer: DamImageCopyToLicenceResponseItem[]) => {
  copyToLicence.mockResolvedValue(answer)
  const wrapper = mount(ImageWidgetMultipleInner, {
    props: { modelValue: [], queueKey: 'gallery', uploadLicence: 2, selectLicences: [1, 2] },
    global: {
      provide: {
        [ImageWidgetUploadConfigKey as symbol]: shallowRef({
          licence: 2,
          extSystem: 1,
          licenceName: '',
          extSystemConfig: {},
        }),
      },
      stubs: {
        ASortableListEditor: true,
        AAssetSelect: AssetSelect,
        AFileInput: true,
        AFileDropzone: true,
        UploadQueueDialog: true,
        AssetDetailDialog: true,
        ImageWidgetMultipleLimitDialog: true,
      },
    },
  })
  const store = useUploadQueuesStore()
  const addByCopyToLicence = vi.spyOn(store, 'addByCopyToLicence').mockResolvedValue(undefined as never)
  vi.spyOn(store, 'queueItemDuplicate').mockResolvedValue(undefined as never)
  wrapper.findComponent(AssetSelect).vm.$emit('confirm', {
    type: 'asset',
    copyToLicence: 2,
    value: answer.map((item) => ({ id: item.asset, licence: 1, mainFile: { id: `main-${item.asset}` } })),
  })
  await flushPromises()
  return { wrapper, addByCopyToLicence }
}

afterEach(() => {
  useUploadQueueDialog().uploadQueueDialog.value = null
})

describe('ImageWidgetMultipleInner copy to licence', () => {
  it('reports every refused asset in one message and opens no queue when none was copied', async () => {
    const { wrapper, addByCopyToLicence } = await confirmCopy([result('a', 'notAllowed'), result('b', 'unassigned')])
    expect(copyToLicence).toHaveBeenCalledTimes(1)
    expect(addByCopyToLicence).not.toHaveBeenCalled()
    expect(showErrorT).toHaveBeenCalledTimes(1)
    expect(showErrorT).toHaveBeenCalledWith('common.damImage.queueItem.errorUnableToCopyToLicence')
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
    wrapper.unmount()
  })

  it('still queues and shows the copied ones next to a refused one', async () => {
    const { wrapper, addByCopyToLicence } = await confirmCopy([
      result('a', 'copy'),
      result('b', 'notAllowed'),
      result('c', 'notAllowed'),
    ])
    expect(addByCopyToLicence).toHaveBeenCalledTimes(1)
    expect(showErrorT).toHaveBeenCalledTimes(1)
    expect(useUploadQueueDialog().uploadQueueDialog.value).toBe('gallery')
    wrapper.unmount()
  })
})
