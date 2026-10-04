<script lang="ts" setup>
import type { ACreateDialogValidation } from '@/shared/types/Validation'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAlerts } from '@/domains/system/composables/alerts'
import { usePageNavigation } from '@/domains/system/composables/pageNavigation'
import { isUndefined } from '@/shared/utils/common'

const props = withDefaults(
  defineProps<{
    buttonClass?: string
    maxWidth?: number | undefined
    dataCy?: string
    v?: ACreateDialogValidation
    callCreate: () => Promise<any>
    disableRedirect?: boolean
    redirectRouteName?: string | undefined
    redirectParamName?: string
    disableShowErrorsDefault?: boolean
  }>(),
  {
    buttonClass: '',
    maxWidth: undefined,
    dataCy: 'button-create',
    v: undefined,
    disableRedirect: false,
    redirectRouteName: undefined,
    redirectParamName: 'id',
    disableShowErrorsDefault: false,
  }
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'open'): void
  (e: 'close'): void
  (e: 'error', data: any): void
  (e: 'success', data: any): void
}>()

const modelValue = defineModel<boolean>({ default: false, required: false })

const { t } = useI18n()

const buttonLoading = ref(false)

const onOpen = () => {
  modelValue.value = true
  emit('open')
}

const onClose = () => {
  modelValue.value = false
  emit('close')
}

const { push } = usePageNavigation()
const { showValidationError, showRecordWas, showErrorsDefault } = useAlerts()

const onConfirm = async () => {
  emit('confirm')
  try {
    buttonLoading.value = true
    props.v?.$touch()
    if (!isUndefined(props.v) && props.v.$invalid) {
      showValidationError()
      buttonLoading.value = false
      return
    }
    const res = await props.callCreate()
    emit('success', res)
    showRecordWas('created')
    onClose()
    if (!isUndefined(res.id) && !props.disableRedirect && props.redirectRouteName) {
      // Not when the user is on the way elsewhere, or there already.
      void push({
        name: props.redirectRouteName,
        params: { [props.redirectParamName]: res[props.redirectParamName] },
      })
    }
  } catch (error) {
    if (!props.disableShowErrorsDefault) {
      showErrorsDefault(error)
    }
    emit('error', error)
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
        <ADialogToolbar @cancel="onClose">
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
