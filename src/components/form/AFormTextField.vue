<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import { isDefined, isUndefined } from '@/utils/common'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import type { VuetifyIconValue } from '@/types/Vuetify'
import type { ErrorObject } from '@vuelidate/core'
import { useI18n } from 'vue-i18n'
import ACollabLockedByUser from '@/components/collab/components/ACollabLockedByUser.vue'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusPayload,
  CollabFieldLockType,
} from '@/components/collab/composables/collabEventBus'
import type { CollabComponentConfig, CollabFieldData, CollabFieldLockOptions } from '@/components/collab/types/Collab'
import { useCollabField } from '@/components/collab/composables/collabField'
import type { IntegerIdNullable } from '@/types/common'
import type { VTextField } from 'vuetify/components/VTextField'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'

const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    label?: string
    errorMessage?: string
    required?: boolean
    v?: any
    prependIcon?: VuetifyIconValue
    appendIcon?: VuetifyIconValue
    dataCy?: string
    hideLabel?: boolean
    type?: string
    step?: number
    maxlength?: number | undefined
    collab?: CollabComponentConfig
    disabled?: boolean
    placeholder?: undefined | string
    persistentPlaceholder?: boolean
    help?: string | undefined
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
    type: 'text',
    step: undefined,
    maxlength: undefined,
    collab: undefined,
    disabled: undefined,
    placeholder: undefined,
    persistentPlaceholder: false,
    help: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: string | number | null | undefined): void
  (e: 'click:append', data: string | number | null | undefined): void
  (e: 'blur', data: string | number | null | undefined): void
  (e: 'focus', data: string | number | null | undefined): void
}>()

const textFieldRef = ref<InstanceType<typeof VTextField> | null>(null)

// Collaboration
const { collabOptions } = useCommonAdminCollabOptions()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const releaseFieldLock = ref((data: CollabFieldData, options?: Partial<CollabFieldLockOptions>) => {})
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
      textFieldRef.value?.blur()
    }
  })
  addCollabGatheringBufferDataListener(() => {
    textFieldRef.value?.blur()
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

const focus = () => {
  textFieldRef.value?.focus()
}

defineExpose({
  focus,
})
</script>

<template>
  <VTextField
    ref="textFieldRef"
    :prepend-icon="prependIcon"
    :data-cy="dataCy"
    :error-messages="errorMessageComputed"
    :model-value="modelValue"
    :required="requiredComputed"
    :type="type"
    :step="step"
    :append-icon="appendIcon"
    :maxlength="maxlength"
    :disabled="disabledComputed"
    :placeholder="placeholder"
    :persistent-placeholder="persistentPlaceholder"
    trim
    autocomplete="off"
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
      v-if="help"
      #append
    >
      <VIcon
        v-tooltip="help"
        icon="mdi-help-circle-outline"
      />
    </template>
  </VTextField>
</template>
