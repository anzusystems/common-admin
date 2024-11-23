<script lang="ts" setup>
import type { ValidationScope } from '@/types/Validation'
import { ADamKeywordCreateValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import type { DamKeyword } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { isUndefined } from '@/utils/common'
import { useDamKeywordFactory } from '@/components/damImage/uploadQueue/keyword/KeywordFactory'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAlerts } from '@/composables/system/alerts'
import { useKeywordValidation } from '@/components/damImage/uploadQueue/keyword/keywordValidation'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { createKeyword, ENTITY } from '@/components/damImage/uploadQueue/api/keywordApi'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import ARow from '@/components/ARow.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import type { IntegerId } from '@/types/common'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
    initialValue?: string
    disableRedirect?: boolean
    variant?: 'button' | 'icon' | 'listItem'
    buttonT?: string
    buttonClass?: string
    dataCy?: string
    disabled?: boolean | undefined
    validationScope?: ValidationScope
  }>(),
  {
    initialValue: '',
    disableRedirect: false,
    variant: 'button',
    buttonT: 'common.button.create',
    buttonClass: 'ml-2',
    dataCy: undefined,
    disabled: undefined,
    validationScope: ADamKeywordCreateValidationScopeSymbol,
  }
)
const emit = defineEmits<{
  (e: 'onSuccess', data: DamKeyword): void
}>()

const { damClient } = useCommonAdminCoreDamOptions()
const { getDamConfigExtSystem } = useDamConfigState()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configExtSystem = getDamConfigExtSystem(props.extSystem)
if (isUndefined(configExtSystem)) {
  throw new Error('Ext system must be initialised.')
}

const { createDefault } = useDamKeywordFactory()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const keyword = ref<DamKeyword>(createDefault(props.extSystem))
const dialog = ref(false)
const buttonLoading = ref(false)

const onClick = () => {
  if (isUndefined(configExtSystem)) {
    throw new Error('Ext system must be initialised.')
  }
  keyword.value = createDefault(props.extSystem, true)
  keyword.value.name = props.initialValue
  dialog.value = true
}

const onCancel = () => {
  dialog.value = false
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { v$ } = useKeywordValidation(keyword, props.validationScope)
const { t } = useI18n()
const { showValidationError, showRecordWas, showErrorsDefault } = useAlerts()

const onConfirm = async () => {
  if (buttonLoading.value) return
  try {
    buttonLoading.value = true
    v$.value.$touch()
    if (v$.value.$invalid) {
      showValidationError()
      buttonLoading.value = false
      return
    }
    const res = await createKeyword(damClient, keyword.value)
    emit('onSuccess', res)
    showRecordWas('created')
    dialog.value = false
    if (!isUndefined(res.id) && !props.disableRedirect) {
      // router.push({ name: ROUTE.DAM.KEYWORD.DETAIL, params: { id: res.id } })
    }
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    buttonLoading.value = false
  }
}
</script>

<template>
  <VListItem v-if="variant === 'listItem'">
    <ABtnSecondary
      size="small"
      :text="initialValue"
      prepend-icon="mdi-plus-circle"
      @click.stop="onClick"
    />
  </VListItem>
  <ABtnPrimary
    v-else-if="variant === 'button'"
    :class="buttonClass"
    :data-cy="dataCy"
    :disabled="disabled"
    rounded="pill"
    @click.stop="onClick"
  >
    {{ t(buttonT) }}
  </ABtnPrimary>
  <VBtn
    v-else
    :class="buttonClass"
    :data-cy="dataCy"
    icon
    :disabled="disabled"
    variant="text"
    size="small"
    @click.stop="onClick"
  >
    <VIcon icon="mdi-plus" />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t('common.damImage.keyword.button.add') }}
    </VTooltip>
  </VBtn>
  <VDialog v-model="dialog">
    <VCard
      v-if="dialog"
      width="500"
      class="mt-0 mr-auto ml-auto"
      data-cy="create-panel"
    >
      <ADialogToolbar @on-cancel="onCancel">
        {{ t('common.damImage.keyword.meta.create') }}
      </ADialogToolbar>
      <VCardText>
        <ASystemEntityScope
          :system="SYSTEM_CORE_DAM"
          :subject="ENTITY"
        >
          <ARow>
            <AFormTextField
              v-model="keyword.name"
              :label="t('common.damImage.keyword.model.name')"
              :v="v$.keyword.name"
              required
              data-cy="keyword-name"
              @keyup.enter="onConfirm"
            />
          </ARow>
        </ASystemEntityScope>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary
          data-cy="button-cancel"
          @click.stop="onCancel"
        >
          {{ t('common.button.cancel') }}
        </ABtnTertiary>
        <ABtnPrimary
          :loading="buttonLoading"
          data-cy="button-confirm"
          @click.stop="onConfirm"
        >
          {{ t(buttonT) }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
