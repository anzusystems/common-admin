<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ValidationScope } from '@/types/Validation'
import { ADamAuthorCreateValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { useDamAuthorType } from '@/components/damImage/uploadQueue/author/DamAuthorType'
import { isUndefined } from '@/utils/common'
import { useAuthorValidation } from '@/components/damImage/uploadQueue/author/authorValidation'
import { useAlerts } from '@/composables/system/alerts'
import { createAuthor } from '@/components/damImage/uploadQueue/api/authorApi'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useDamAuthorFactory } from '@/components/damImage/uploadQueue/author/AuthorFactory'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import ARow from '@/components/ARow.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import AFormValueObjectOptionsSelect from '@/components/form/AFormValueObjectOptionsSelect.vue'
import type { IntegerId } from '@/types/common'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
    initialValue?: string
    disableRedirect?: boolean
    variant?: 'button' | 'icon'
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
    validationScope: ADamAuthorCreateValidationScopeSymbol,
  }
)
const emit = defineEmits<{
  (e: 'onSuccess', data: DamAuthor): void
}>()

const { damClient } = useCommonAdminCoreDamOptions()
const { getDamConfigExtSystem } = useDamConfigState()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const configExtSystem = getDamConfigExtSystem(props.extSystem)
if (isUndefined(configExtSystem)) {
  throw new Error('Ext system must be initialised.')
}

const { createDefault } = useDamAuthorFactory()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const author = ref<DamAuthor>(createDefault(props.extSystem))
const dialog = ref(false)
const buttonLoading = ref(false)

const onClick = (textOverride?: string) => {
  if (isUndefined(configExtSystem)) {
    throw new Error('Ext system must be initialised.')
  }
  author.value = createDefault(props.extSystem, true)
  textOverride ? author.value.name = textOverride : author.value.name = props.initialValue
  dialog.value = true
}

const onCancel = () => {
  dialog.value = false
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { v$ } = useAuthorValidation(author, props.validationScope)
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
    const res = await createAuthor(damClient, author.value)
    emit('onSuccess', res)
    showRecordWas('created')
    dialog.value = false
    if (!isUndefined(res.id) && !props.disableRedirect) {
      // router.push({ name: ROUTE.DAM.AUTHOR.DETAIL, params: { id: res.id } })
    }
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    buttonLoading.value = false
  }
}

const { authorTypeOptions } = useDamAuthorType()

defineExpose({
  open: onClick,
})
</script>

<template>
  <ABtnPrimary
    v-if="variant === 'button'"
    :class="buttonClass"
    :data-cy="dataCy"
    :disabled="disabled"
    rounded="pill"
    @click.stop="onClick(undefined)"
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
      {{ t('common.damImage.author.button.add') }}
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
        {{ t('common.damImage.author.meta.create') }}
      </ADialogToolbar>
      <VCardText>
        <ASystemEntityScope
          :system="SYSTEM_CORE_DAM"
          subject="author"
        >
          <ARow>
            <AFormTextField
              v-model="author.name"
              :label="t('common.damImage.author.model.name')"
              :v="v$.author.name"
              required
              data-cy="author-name"
              @keyup.enter="onConfirm"
            />
          </ARow>
          <ARow>
            <AFormTextField
              v-model="author.identifier"
              :label="t('common.damImage.author.model.identifier')"
              :v="v$.author.identifier"
              data-cy="author-identifier"
              @keyup.enter="onConfirm"
            />
          </ARow>
          <ARow>
            <AFormValueObjectOptionsSelect
              v-model="author.type"
              :label="t('common.damImage.author.model.type')"
              :items="authorTypeOptions"
              data-cy="author-type"
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
