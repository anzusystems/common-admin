<script lang="ts" setup>
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { isImageWidgetUploadConfigAllowed } from '@/domains/dam/config/utils/damFilterUserAllowedUploadConfigs'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import AImageWidgetMultipleSimple from '@/domains/dam/imageWidget/components/AImageWidgetMultipleSimple.vue'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import type { IntegerId } from '@/shared/types/common'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import { isUndefined } from '@/shared/utils/common'
import { onMounted, provide, ref, shallowRef } from 'vue'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { useI18n } from 'vue-i18n'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[] // initial ids, updated only when save is called
    queueKey: UploadQueueKey
    uploadLicence: IntegerId
    selectLicences: IntegerId[]
    configName?: string
    label?: string | undefined
    readonly?: boolean
    dataCy?: string | undefined
    width?: number | undefined
    callDeleteApiOnRemove?: boolean
  }>(),
  {
    configName: undefined,
    label: undefined,
    image: undefined,
    readonly: false,
    lockable: false,
    lockedById: undefined,
    dataCy: undefined,
    expandOptions: false,
    width: undefined,
    callDeleteApiOnRemove: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerId[]): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const status = ref<'loading' | 'ready' | 'error'>('loading')
// Without upload permission the existing image is still shown, read-only.
const uploadAllowed = ref(true)

const { damClient } = useCommonAdminCoreDamOptions(damConfigName)
const {
  loadDamPrvConfig,
  loadDamConfigAssetCustomFormElements,
  getDamConfigAssetCustomFormElements,
  getOrLoadDamConfigExtSystemByLicence,
  getOrLoadDamConfigExtSystemByLicences,
} = useDamConfigState(damClient, damConfigName)

const uploadConfig = shallowRef<DamConfigLicenceExtSystemReturnType | undefined>(undefined)

const { cachedExtSystemId } = useExtSystemIdForCached(damConfigName)

onMounted(async () => {
  const damConfigStore = useDamConfigStoreOf(damConfigName)
  uploadConfig.value = await getOrLoadDamConfigExtSystemByLicence(props.uploadLicence)
  if (isUndefined(uploadConfig.value)) {
    status.value = 'error'
    return
  }
  cachedExtSystemId.value = uploadConfig.value.extSystem
  if (!isImageWidgetUploadConfigAllowed(uploadConfig.value, damConfigName)) {
    uploadAllowed.value = false
    try {
      if (!damConfigStore.initialized.damPrvConfig) await loadDamPrvConfig()
      status.value = 'ready'
    } catch (e) {
      status.value = 'error'
    }
    return
  }
  const promises: Promise<any>[] = []
  if (!damConfigStore.initialized.damPrvConfig) {
    promises.push(loadDamPrvConfig())
  }
  promises.push(getOrLoadDamConfigExtSystemByLicences(props.selectLicences))
  const { extSystem } = uploadConfig.value
  // Loads custom fields for every type of the ext system if none are loaded yet.
  // Otherwise loads only the image type if its earlier read failed. Loaded types are not read again.
  if (isUndefined(getDamConfigAssetCustomFormElements(extSystem, DamAssetType.Image))) {
    promises.push(
      loadDamConfigAssetCustomFormElements(
        extSystem,
        getDamConfigAssetCustomFormElements(extSystem) ? [DamAssetType.Image] : undefined
      )
    )
  }
  try {
    await Promise.all(promises)
  } catch (e) {
    status.value = 'error'
  }
  // If the image type failed while other types loaded, the form would have no fields, so this is an error.
  if (isUndefined(getDamConfigAssetCustomFormElements(extSystem, DamAssetType.Image))) status.value = 'error'
  if (status.value !== 'error') status.value = 'ready'
})

const innerComponent = ref<InstanceType<typeof ImageWidgetMultipleInner> | null>(null)

const saveImages = async () => {
  if (!innerComponent.value) return false
  return (await innerComponent.value.saveImages()) as boolean
}

provide(ImageWidgetUploadConfigKey, uploadConfig)

defineExpose({
  saveImages,
})

const { t } = useI18n()
</script>

<template>
  <ImageWidgetMultipleInner
    v-if="status === 'ready'"
    ref="innerComponent"
    v-bind="props"
    :readonly="readonly || !uploadAllowed"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <!-- The config also fails for a user without access to the licence. The existing image is still shown. -->
  <div v-else-if="status === 'error'">
    <AImageWidgetMultipleSimple
      v-if="modelValue.length"
      :model-value="modelValue"
      :config-name="damConfigName"
      :label="label"
      :width="width"
    />
    <div class="text-error">
      {{ t('common.damImage.error.loadingConfig') }}
    </div>
  </div>
  <VProgressCircular
    v-else
    :size="12"
    :width="2"
    indeterminate
  />
</template>
