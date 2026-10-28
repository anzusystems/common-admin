<script lang="ts" setup>
import type { AFormFieldValidation } from '@/shared/types/Validation'
import { computed, inject, ref, watch, unref } from 'vue'
import { useDisplay } from 'vuetify'
import { stringSplitOnFirstOccurrence } from '@/shared/utils/string'
import { isDefined, isNumber, isUndefined } from '@/shared/utils/common'
import { SubjectScopeKey, SystemScopeKey } from '@/shared/injectionKeys'
import type { VuetifyIconValue } from '@/shared/types/Vuetify'
import { useI18n } from 'vue-i18n'
import type { VTextField } from 'vuetify/components/VTextField'
import type { CollabComponentConfig, CollabFieldData, CollabFieldLockOptions } from '@/domains/collab/types/Collab'
import type { IntegerIdNullable } from '@/shared/types/common'
import ACollabLockedByUser from '@/domains/collab/components/ACollabLockedByUser.vue'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusPayload,
  CollabFieldLockType,
} from '@/domains/collab/composables/collabEventBus'
import { useCollabField } from '@/domains/collab/composables/collabField'
import { useCommonAdminCollabOptions } from '@/domains/collab/composables/commonAdminCollabOptions'

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined // todo check number and null
    label?: string | undefined
    errorMessage?: string | undefined
    required?: boolean | undefined
    v?: AFormFieldValidation | null
    prependIcon?: VuetifyIconValue | undefined
    appendIcon?: VuetifyIconValue | undefined
    dataCy?: string | undefined
    hideLabel?: boolean
    rows?: number
    collab?: CollabComponentConfig | undefined
    disabled?: boolean | undefined
    help?: string | undefined
    suggestedLength?: number | undefined
    readonly?: boolean
  }>(),
  {
    label: undefined,
    errorMessage: undefined,
    required: undefined,
    v: null,
    prependIcon: undefined,
    appendIcon: undefined,
    dataCy: undefined,
    hideLabel: false,
    rows: 1,
    collab: undefined,
    disabled: undefined,
    help: undefined,
    suggestedLength: undefined,
    // Left to a `VForm` around it when not set.
    readonly: undefined,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: string | null | undefined): void
  (e: 'click:append', data: string | null): void
  (e: 'blur', data: string | null | undefined): void
  (e: 'focus', data: string | null | undefined): void
}>()

const { mdAndDown } = useDisplay()
const textareaRef = ref<InstanceType<typeof VTextField> | null>(null)

// Collaboration
const { collabOptions } = useCommonAdminCollabOptions()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const releaseFieldLock = ref((data: CollabFieldData) => {})
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const acquireFieldLock = ref((options?: Partial<CollabFieldLockOptions>) => {})
const lockedByUserLocal = ref<IntegerIdNullable>(null)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (collabOptions.value.enabled && isDefined(props.collab)) {
  const {
    releaseCollabFieldLock,
    acquireCollabFieldLock,
    addCollabFieldLockStatusListener,
    addCollabGatheringBufferDataListener,
    lockedByUser,
  } = useCollabField(props.collab.room, props.collab.field, false, true)
  releaseFieldLock.value = releaseCollabFieldLock
  acquireFieldLock.value = acquireCollabFieldLock
  watch(
    lockedByUser,
    (newValue) => {
      lockedByUserLocal.value = newValue
    },
    { immediate: true }
  )
  addCollabFieldLockStatusListener((data: CollabFieldLockStatusPayload) => {
    if (data.status === CollabFieldLockStatus.Failure && data.type === CollabFieldLockType.Acquire) {
      textareaRef.value?.blur()
    }
  })
  addCollabGatheringBufferDataListener(() => {
    textareaRef.value?.blur()
  })
}

const { t } = useI18n()

const system = inject<string | undefined>(SystemScopeKey, undefined)
const subject = inject<string | undefined>(SubjectScopeKey, undefined)

const onUpdate = (newValue: string) => {
  emit('update:modelValue', newValue)
}
const onBlur = () => {
  emit('blur', props.modelValue)
  props.v?.$touch()
  releaseFieldLock.value(props.modelValue)
}

const onFocus = () => {
  emit('focus', props.modelValue)
  acquireFieldLock.value()
}

const errorMessageComputed = computed(() => {
  if (isDefined(props.errorMessage)) return [props.errorMessage]
  if (props.v?.$errors?.length) return [props.v.$errors.map((item) => unref(item.$message)).join(' ')]
  return []
})

const labelComputed = computed(() => {
  if (isDefined(props.label)) return props.label
  if (isUndefined(system) || isUndefined(subject) || isUndefined(props.v?.$path)) return ''
  const { end: path } = stringSplitOnFirstOccurrence(props.v?.$path, '.')
  return t(system + '.' + subject + '.model.' + path)
})

const requiredComputed = computed(() => {
  if (isDefined(props.required)) return props.required
  if ((props.v?.required as { $params?: { type?: string } } | undefined)?.$params?.type === 'required') return true
  return false
})

const disabledComputed = computed(() => {
  if (isDefined(props.disabled)) return props.disabled
  return !!lockedByUserLocal.value
})

const showCounterWarning = (counterValue: string | number | undefined) => {
  if (isNumber(counterValue) && !isUndefined(props.suggestedLength)) {
    return counterValue > props.suggestedLength
  }
  return false
}

const focus = () => {
  textareaRef.value?.focus()
}

defineExpose({
  focus,
})
</script>

<template>
  <VTextarea
    ref="textareaRef"
    :prepend-icon="prependIcon"
    :data-cy="dataCy"
    :error-messages="errorMessageComputed"
    :model-value="modelValue"
    :required="requiredComputed"
    :disabled="disabledComputed"
    :readonly="readonly"
    :rows="rows"
    auto-grow
    :append-icon="appendIcon"
    @click:append="(event: any) => emit('click:append', event)"
    @blur="onBlur"
    @focus="onFocus"
    @update:model-value="onUpdate($event)"
  >
    <template
      v-if="!hideLabel"
      #label
    >
      {{ labelComputed
      }}<span
        v-if="requiredComputed"
        class="a-required-mark"
      />
    </template>
    <template
      v-if="lockedByUserLocal"
      #append-inner
    >
      <slot
        name="locked"
        :user-id="lockedByUserLocal"
      >
        <ACollabLockedByUser
          v-if="collab"
          :id="lockedByUserLocal"
          :users="collab.cachedUsers"
        />
      </slot>
    </template>
    <template
      v-if="$slots.prepend"
      #prepend
    >
      <slot name="prepend" />
    </template>
    <template
      v-if="$slots.counter"
      #counter="counterProps"
    >
      <slot
        name="counter"
        :props="counterProps"
      />
    </template>
    <template
      v-else-if="suggestedLength"
      #counter="{ value: counterValue }"
    >
      <span :class="{ 'text-warning': showCounterWarning(counterValue) }">
        {{ t('common.system.inputSuggestedMax', { current: counterValue, max: suggestedLength }) }}
      </span>
    </template>
    <template
      v-if="help && !mdAndDown"
      #append
    >
      <VIcon
        v-tooltip="help"
        icon="mdi-help-circle-outline"
      />
    </template>
  </VTextarea>
</template>
