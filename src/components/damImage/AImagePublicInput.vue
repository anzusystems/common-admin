<script setup lang="ts">
import type { ImageAware, ImageWidgetSelectConfig } from '@/types/ImageAware'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { fetchAssetByFileId } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { isDocId, isString } from '@/utils/common'
import { ref } from 'vue'
import type { AssetDetailItemDto } from '@/types/coreDam/Asset'
import type { IntegerIdNullable } from '@/types/common'

const props = withDefaults(
  defineProps<{
    selectConfig: ImageWidgetSelectConfig[]
    image?: ImageAware | undefined // optional, if available, no need to fetch image data
    configName?: string
    label?: string | undefined
    dataCy?: string | undefined
  }>(),
  {
    image: undefined,
    configName: 'default',
    label: undefined,
    dataCy: undefined,
  }
)
const modelValue = defineModel<IntegerIdNullable>({ default: null, required: true })
const inputField = defineModel<string>({ default: '', required: false })

const isValid = ref(true)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCommonAdminCoreDamOptions(props.configName)

const extractUUID = (url: string): string | undefined => {
  const regex = /\/image\/original\/([0-9a-fA-F-]+)\.jpg/
  const match = url.match(regex)

  return match ? match[1] : undefined
}

const validateAssetData = (asset: AssetDetailItemDto, configs: ImageWidgetSelectConfig[]) => {
  configs.forEach((config) => {
    if (config.licence === asset.licence) {
      return true
    }
  })
  return false
}

const submit = async () => {
  isValid.value = true
  inputField.value = inputField.value.trim()
  if (inputField.value.startsWith('http')) {
    const extracted = extractUUID(inputField.value)
    if (isString(extracted)) inputField.value = extracted
  }
  if (!isDocId(inputField.value)) {
    isValid.value = false
    return Promise.reject('Incorrect URL/ID provided')
  }

  try {
    const assetRes = await fetchAssetByFileId(damClient, inputField.value)
    if (validateAssetData(assetRes, props.selectConfig)) {
      return Promise.resolve(assetRes)
    }
    isValid.value = false
    return Promise.reject('Incorrect asset or no access')
  } catch (e) {
    isValid.value = false
    return Promise.reject('Incorrect asset or no access')
  }
}

defineExpose({
  submit,
})
</script>

<template>
  <VTextField
    v-model="inputField"
    :label="label"
    :error="!isValid"
  />
</template>
