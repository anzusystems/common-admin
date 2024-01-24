<script setup lang="ts">
import type { ImageAware, ImageCreateUpdateAware, ImageWidgetSelectConfig } from '@/types/ImageAware'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { fetchAssetByFileId } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { cloneDeep, isDocId, isNull, isString } from '@/utils/common'
import { ref, toRaw, watch } from 'vue'
import type { AssetDetailItemDto } from '@/types/coreDam/Asset'
import type { IntegerIdNullable } from '@/types/common'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import { createImage, fetchImage, updateImage } from '@/components/damImage/uploadQueue/api/imageApi'
import { useImageActions } from '@/components/damImage/composables/imageActions'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useAlerts } from '@/composables/system/alerts'

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
const inputDescription = ref('')
const inputSource = ref('')

const resolvedSrc = ref('')
const resImage = ref<null | ImageCreateUpdateAware>(null)

const isValid = ref(true)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { damClient } = useCommonAdminCoreDamOptions()
const { widgetImageToDamImageOriginalUrl } = useImageActions(imageOptions)

const { showErrorsDefault } = useAlerts()

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
    if (isNull(assetRes.mainFile)) {
      isValid.value = false
      return Promise.reject('Incorrect asset or no access')
    }
    if (validateAssetData(assetRes, props.selectConfig)) {
      const data: ImageCreateUpdateAware = {
        texts: {
          description: '',
          source: '',
        },
        dam: {
          damId: assetRes.mainFile.id,
          licenceId: assetRes.licence,
          regionPosition: 0,
        },
        position: 0,
      }
      if (resImage.value?.id) {
        data.id = resImage.value.id
      }
      const imageRes = resImage.value?.id
        ? await updateImage(imageClient, resImage.value.id, data)
        : await createImage(imageClient, data)
      return Promise.resolve({ asset: assetRes, image: imageRes })
    }
    isValid.value = false
    return Promise.reject('Incorrect asset or no access')
  } catch (e) {
    isValid.value = false
    showErrorsDefault(e)
    return Promise.reject('Incorrect asset or no access')
  }
}

const reload = async (newImage: ImageCreateUpdateAware | undefined, newImageId: IntegerIdNullable, force = false) => {
  resolvedSrc.value = imagePlaceholderPath
  if ((newImage && isNull(resImage.value)) || (newImage && force)) {
    resImage.value = cloneDeep(newImage)
    if (resImage.value) {
      resolvedSrc.value = widgetImageToDamImageOriginalUrl(toRaw(resImage.value))
      inputDescription.value = resImage.value.texts.description
      inputSource.value = resImage.value.texts.source
    }
    return
  }
  if (newImageId) {
    try {
      resImage.value = await fetchImage(imageClient, newImageId)
    } catch (error) {
      showErrorsDefault(error)
    }
    if (!isNull(resImage.value)) {
      resolvedSrc.value = widgetImageToDamImageOriginalUrl(toRaw(resImage.value))
      inputDescription.value = resImage.value.texts.description
      inputSource.value = resImage.value.texts.source
    }
    return
  }
  resImage.value = null
  inputDescription.value = ''
  inputSource.value = ''
}

watch(
  [() => props.image, modelValue],
  async ([newImage, newImageId]) => {
    await reload(newImage, newImageId)
  },
  { immediate: true }
)

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
  <VTextField
    v-model="inputDescription"
    :label="label"
  />
  <VTextField
    v-model="inputSource"
    :label="label"
  />
  <div v-if="resolvedSrc.length > 0">
    Image Preview:
    <img
      :src="resolvedSrc"
      alt=""
    >
  </div>
</template>
