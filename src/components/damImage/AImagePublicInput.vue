<script setup lang="ts">
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { fetchAssetByFileId } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { cloneDeep, isDocId, isNull, isString } from '@/utils/common'
import { computed, ref, toRaw, watch } from 'vue'
import type { AssetDetailItemDto } from '@/types/coreDam/Asset'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { createImage, fetchImage, updateImage } from '@/components/damImage/uploadQueue/api/imageApi'
import { useImageActions } from '@/components/damImage/composables/imageActions'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useAlerts } from '@/composables/system/alerts'
import { useI18n } from 'vue-i18n'
import AFormTextField from '@/components/form/AFormTextField.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import ARow from '@/components/ARow.vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'

const props = withDefaults(
  defineProps<{
    selectLicences: IntegerId[]
    image?: ImageAware | undefined // optional, if available, no need to fetch image data
    configName?: string
    labelT?: string | undefined
    dataCy?: string | undefined
  }>(),
  {
    image: undefined,
    configName: 'default',
    labelT: 'common.damImage.public.idOrUrl',
    dataCy: undefined,
  }
)
const modelValue = defineModel<IntegerIdNullable>({ default: null, required: true })
const inputField = ref('')
const meta = ref({ description: '', source: '' })

const resolvedSrc = ref('')
const resImage = ref<null | ImageCreateUpdateAware>(null)

const isValid = ref(true)
const isDirty = ref(false)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { damClient } = useCommonAdminCoreDamOptions()
const { widgetImageToDamImageOriginalUrl } = useImageActions(imageOptions)

const { showErrorsDefault, showValidationError } = useAlerts()
const { t } = useI18n()

const extractUUID = (url: string): string | undefined => {
  const regex = /\/image\/original\/([0-9a-fA-F-]+)\.jpg/
  const match = url.match(regex)

  return match ? match[1] : undefined
}

const validateAssetData = (asset: AssetDetailItemDto, licences: IntegerId[]) => {
  return licences.some((licence) => licence === asset.licence)
}

const { required, maxLength } = useValidate()

const rules = {
  meta: {
    description: {
      maxLength: maxLength(255),
    },
    source: {
      required,
      maxLength: maxLength(255),
    },
  },
}
const v$ = useVuelidate(rules, { meta }, { $stopPropagation: true })

const validateField = async () => {
  isDirty.value = true
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
      return Promise.reject('Incorrect asset mainFile')
    }
    if (validateAssetData(assetRes, props.selectLicences)) {
      isValid.value = true
      return Promise.resolve(assetRes)
    }
    isValid.value = false
    return Promise.reject('Incorrect asset or no access')
  } catch (e) {
    isValid.value = false
    return Promise.reject('Incorrect asset or no access')
  }
}

const submit = async () => {
  try {
    const asset = await validateField()
    v$.value.$touch()
    if (v$.value.$invalid) {
      showValidationError()
      return Promise.reject('Invalid source or description')
    }
    const data: ImageCreateUpdateAware = {
      texts: {
        description: meta.value.description.trim(),
        source: meta.value.source.trim(),
      },
      dam: {
        damId: asset.mainFile!.id,
        licenceId: asset.licence,
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
    resImage.value = imageRes
    modelValue.value = imageRes.id
    return Promise.resolve({ asset: asset, image: imageRes })
  } catch (e) {
    showErrorsDefault(e)
  }
}

const updatePreviewAndTexts = () => {
  resolvedSrc.value = widgetImageToDamImageOriginalUrl({
    texts: {
      description: '',
      source: '',
    },
    dam: {
      damId: inputField.value,
      licenceId: 0,
      regionPosition: 0,
    },
  })
}

const onBlur = async () => {
  try {
    await validateField()
    updatePreviewAndTexts()
  } catch (e) {
    //
  }
}

const reload = async (newImage: ImageCreateUpdateAware | undefined, newImageId: IntegerIdNullable, force = false) => {
  resolvedSrc.value = ''
  if ((newImage && isNull(resImage.value)) || (newImage && force)) {
    resImage.value = cloneDeep(newImage)
    if (resImage.value) {
      inputField.value = resImage.value.dam.damId
      resolvedSrc.value = widgetImageToDamImageOriginalUrl(toRaw(resImage.value))
      meta.value.description = resImage.value.texts.description
      meta.value.source = resImage.value.texts.source
      onBlur()
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
      inputField.value = resImage.value.dam.damId
      resolvedSrc.value = widgetImageToDamImageOriginalUrl(toRaw(resImage.value))
      meta.value.description = resImage.value.texts.description
      meta.value.source = resImage.value.texts.source
      onBlur()
    }
    return
  }
  resImage.value = null
  meta.value.description = ''
  meta.value.source = ''
}

const disabled = computed(() => !(isValid.value && isDirty.value))

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
  <ARow>
    <AFormTextField
      v-model="inputField"
      :label="labelT ? t(labelT) : undefined"
      :error="!isValid"
      :error-message="isValid ? undefined : t('common.damImage.public.inputError')"
      required
      @blur="onBlur"
      @keyup.enter="onBlur"
    />
  </ARow>
  <ARow>
    <AFormTextarea
      v-model="meta.description"
      :label="t('common.damImage.image.model.texts.description')"
      :v="v$.meta.description"
      :disabled="disabled"
    />
  </ARow>
  <ARow>
    <AFormTextarea
      v-model="meta.source"
      :label="t('common.damImage.image.model.texts.source')"
      :v="v$.meta.source"
      :disabled="disabled"
    />
  </ARow>
  <ARow style="min-height: 50px">
    <div>{{ t('common.damImage.public.imagePreview') }}:</div>
    <img
      v-if="resolvedSrc.length > 0"
      :src="resolvedSrc"
      alt=""
    >
  </ARow>
</template>
