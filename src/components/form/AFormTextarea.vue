<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import { isDefined, isNumber, isUndefined } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import type { VuetifyIconValue } from '@/types/Vuetify'
import type { ErrorObject } from '@vuelidate/core'
import { useI18n } from 'vue-i18n'
import type { VTextField } from 'vuetify/components/VTextField'
import type { CollabComponentConfig, CollabFieldData, CollabFieldLockOptions } from '@/components/collab/types/Collab'
import type { IntegerIdNullable } from '@/types/common'
import ACollabLockedByUser from '@/components/collab/components/ACollabLockedByUser.vue'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusPayload,
  CollabFieldLockType,
} from '@/components/collab/composables/collabEventBus'
import { useCollabField } from '@/components/collab/composables/collabField'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined // todo check number and null
    label?: string | undefined
    errorMessage?: string | undefined
    required?: boolean | undefined
    v?: any
    prependIcon?: VuetifyIconValue | undefined
    appendIcon?: VuetifyIconValue | undefined
    dataCy?: string | undefined
    hideLabel?: boolean
    rows?: number
    collab?: CollabComponentConfig | undefined
    disabled?: boolean | undefined
    help?: string | undefined
    suggestedLength?: number | undefined
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
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: string | null | undefined): void
  (e: 'click:append', data: string | null): void
  (e: 'blur', data: string | null | undefined): void
  (e: 'focus', data: string | null | undefined): void
}>()

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
  } = useCollabField(props.collab.room, props.collab.field)
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

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

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
  if (props.v?.$errors?.length) return [props.v.$errors.map((item: ErrorObject) => item.$message).join(' ')]
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
  if (props.v?.required && props.v?.required.$params.type === 'required') return true
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
    :rows="rows"
    auto-grow
    :append-icon="appendIcon"
    trim
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
        class="required"
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
      v-if="help"
      #append
    >
      <VIcon
        v-tooltip="help"
        icon="mdi-help-circle-outline"
      />
    </template>
  </VTextarea>
</template>
