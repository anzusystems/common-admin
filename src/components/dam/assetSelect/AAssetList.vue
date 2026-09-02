<script lang="ts" setup>
import { onMounted, provide, ref, shallowRef } from 'vue'
import { type AssetDetailItemDto, type DamAssetTypeType } from '@/types/coreDam/Asset'
import type { IntegerId } from '@/types/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { isUndefined } from '@/utils/common'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { ImageWidgetUploadConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import AAssetListInner from '@/components/dam/assetSelect/AAssetListInner.vue'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetTypeType
    queueKey: UploadQueueKey
    inPodcast?: boolean | null
    selectLicences: IntegerId[]
    uploadLicence?: IntegerId | undefined
    configName?: string
    skipCurrentUserCheck?: boolean
    onDetailLoadedCallback?: ((asset: AssetDetailItemDto) => void) | undefined
  }>(),
  {
    inPodcast: null,
    uploadLicence: undefined,
    configName: 'default',
    skipCurrentUserCheck: false,
    onDetailLoadedCallback: undefined,
  },
)

const sortModel = defineModel<number>('sort', { default: 1, required: false })

const status = ref<'loading' | 'ready' | 'error'>('loading')

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCommonAdminCoreDamOptions(props.configName)
const {
  getOrLoadDamConfigExtSystemByLicence,
  getOrLoadDamConfigExtSystemByLicences,
  getDamConfigAssetCustomFormElements,
  loadDamConfigAssetCustomFormElements,
} = useDamConfigState(damClient)

const selectConfigs = shallowRef<DamConfigLicenceExtSystemReturnType[]>([])
const uploadConfig = shallowRef<DamConfigLicenceExtSystemReturnType | undefined>(undefined)

provide(ImageWidgetUploadConfig, uploadConfig)

onMounted(async () => {
  try {
    selectConfigs.value = await getOrLoadDamConfigExtSystemByLicences(props.selectLicences)

    if (props.uploadLicence) {
      uploadConfig.value = await getOrLoadDamConfigExtSystemByLicence(props.uploadLicence)
      if (uploadConfig.value) {
        const formElements = getDamConfigAssetCustomFormElements(uploadConfig.value.extSystem)
        if (isUndefined(formElements)) {
          await loadDamConfigAssetCustomFormElements(uploadConfig.value.extSystem)
        }
      }
    }

    status.value = 'ready'
  } catch (e) {
    status.value = 'error'
  }
})
</script>

<template>
  <div
    v-if="status === 'loading'"
    class="w-100 d-flex align-center justify-center"
  >
    <VProgressCircular indeterminate />
  </div>
  <AAssetListInner
    v-else-if="status === 'ready' && selectConfigs.length > 0"
    v-model:sort="sortModel"
    :asset-type="assetType"
    :queue-key="queueKey"
    :select-configs="selectConfigs"
    :in-podcast="inPodcast"
    :config-name="configName"
    :skip-current-user-check="skipCurrentUserCheck"
    :on-detail-loaded-callback="onDetailLoadedCallback"
  >
    <template
      v-if="$slots['upload-activator']"
      #upload-activator="slotProps"
    >
      <slot
        name="upload-activator"
        v-bind="slotProps"
      />
    </template>
    <template
      v-if="$slots.filter"
      #filter
    >
      <slot name="filter" />
    </template>
  </AAssetListInner>
  <div
    v-else-if="status === 'error'"
    class="text-error"
  >
    Loading DAM config error
  </div>
  <div v-else>Error, no select licence.</div>
</template>
