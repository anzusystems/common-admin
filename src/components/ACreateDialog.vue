<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAlerts } from '@/composables/system/alerts'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    buttonClass?: string
    maxWidth?: number | undefined
    dataCy?: string
    v?: any
    callCreate: () => Promise<any>
    disableRedirect?: boolean
    redirectRouteName?: string | undefined
    redirectParamName?: string
  }>(),
  {
    buttonClass: '',
    maxWidth: undefined,
    dataCy: 'button-create',
    v: undefined,
    disableRedirect: false,
    redirectRouteName: undefined,
    redirectParamName: 'id',
  }
)

const emit = defineEmits<{
  (e: 'onConfirm'): void
  (e: 'onOpen'): void
  (e: 'onClose'): void
  (e: 'onError', data: any): void
  (e: 'onSuccess', data: any): void
}>()

const modelValue = defineModel<boolean>({ default: false, required: false })

const { t } = useI18n()

const buttonLoading = ref(false)

const onOpen = () => {
  modelValue.value = true
  emit('onOpen')
}

const onClose = () => {
  modelValue.value = false
  emit('onClose')
}

const router = useRouter()
const { showValidationError, showRecordWas, showErrorsDefault } = useAlerts()

const onConfirm = async () => {
  emit('onConfirm')
  try {
    buttonLoading.value = true
    props.v?.$touch()
    if (!isUndefined(props.v) && props.v.$invalid) {
      showValidationError()
      buttonLoading.value = false
      return
    }
    const res = await props.callCreate()
    emit('onSuccess', res)
    showRecordWas('created')
    onClose()
    if (!isUndefined(res.id) && !props.disableRedirect && props.redirectRouteName) {
      router.push({
        name: props.redirectRouteName,
        params: { [props.redirectParamName]: res[props.redirectParamName] },
      })
    }
  } catch (error) {
    showErrorsDefault(error)
    emit('onError', error)
  } finally {
    buttonLoading.value = false
  }
}
</script>

<template>
  <ABtnPrimary
    :class="buttonClass"
    rounded="pill"
    :data-cy="dataCy"
    @click.stop="onOpen"
  >
    <slot name="button-title">
      {{ t('common.button.create') }}
    </slot>
    <VDialog
      :model-value="modelValue"
      :max-width="maxWidth"
      persistent
      @update:model-value="modelValue = $event"
    >
      <VCard
        v-if="modelValue"
        data-cy="create-panel"
      >
        <ADialogToolbar @on-cancel="onClose">
          <slot name="title">
            {{ t('common.button.create') }}
          </slot>
        </ADialogToolbar>
        <VCardText>
          <slot name="content" />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <ABtnTertiary
            data-cy="button-cancel"
            @click.stop="onClose"
          >
            {{ t('common.button.cancel') }}
          </ABtnTertiary>
          <ABtnPrimary
            :loading="buttonLoading"
            data-cy="button-confirm"
            @click.stop="onConfirm"
          >
            <slot name="button-confirm-title">
              {{ t('common.button.create') }}
            </slot>
          </ABtnPrimary>
        </VCardActions>
      </VCard>
    </VDialog>
  </ABtnPrimary>
</template>
