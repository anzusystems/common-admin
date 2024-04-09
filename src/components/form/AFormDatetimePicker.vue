<script lang="ts" setup>
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { isDefined, isUndefined } from '@/utils/common'
import type { ErrorObject } from '@vuelidate/core'
import { stringSplitOnFirstOccurrence } from '@/utils/string'
import type { DatetimeUTCNullable, IntegerIdNullable } from '@/types/common'
import type { CollabComponentConfig, CollabFieldData, CollabFieldDataEnvelope } from '@/components/collab/types/Collab'
import { useCollabField } from '@/components/collab/composables/collabField'
import ACollabLockedByUser from '@/components/collab/components/ACollabLockedByUser.vue'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'
import ADatetimePicker from '@/components/datetime/ADatetimePicker.vue'

const props = withDefaults(
  defineProps<{
    modelValue: DatetimeUTCNullable | undefined
    label?: string
    errorMessage?: string
    required?: boolean
    v?: any
    dataCy?: string
    clearable?: boolean
    collab?: CollabComponentConfig
    disabled?: boolean
  }>(),
  {
    label: undefined,
    errorMessage: undefined,
    required: undefined,
    v: null,
    dataCy: undefined,
    clearable: false,
    collab: undefined,
    disabled: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: DatetimeUTCNullable | undefined): void
  (e: 'click:append', data: string | number | null | undefined): void
  (e: 'blur', data: string | number | null | undefined): void
  (e: 'focus', data: string | number | null | undefined): void
}>()

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue: DatetimeUTCNullable | undefined) {
    emit('update:modelValue', newValue)
  },
})

// Collaboration
const { collabOptions } = useCommonAdminCollabOptions()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const releaseFieldLock = ref((data: CollabFieldData) => {})
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const changeFieldData = ref((data: CollabFieldData) => {})
const acquireFieldLock = ref(() => {})
const lockedByUserLocal = ref<IntegerIdNullable>(null)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (collabOptions.value.enabled && isDefined(props.collab)) {
  const {
    releaseCollabFieldLock,
    changeCollabFieldData,
    acquireCollabFieldLock,
    addCollabFieldDataChangeListener,
    lockedByUser,
    // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  } = useCollabField(props.collab.room, props.collab.field)
  releaseFieldLock.value = releaseCollabFieldLock
  changeFieldData.value = changeCollabFieldData
  acquireFieldLock.value = acquireCollabFieldLock
  watch(
    lockedByUser,
    (newValue) => {
      lockedByUserLocal.value = newValue
    },
    { immediate: true }
  )
  if (!collabOptions.value.disableCollabFieldDataChangeListener) {
    addCollabFieldDataChangeListener((data: CollabFieldDataEnvelope) => {
      emit('update:modelValue', data.value as DatetimeUTCNullable | undefined)
    })
  }
}

const isOpened = ref(false)
const isFocused = ref(false)

const onOpen = () => {
  isOpened.value = true
  acquireFieldLock.value()
}

const onClose = () => {
  releaseFieldLock.value(props.modelValue)
  isOpened.value = true
}

const { t } = useI18n()

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const onBlur = () => {
  isFocused.value = false
  emit('blur', isUndefined(props.modelValue) ? null : props.modelValue)
  props.v?.$touch()
  if (isOpened.value === false) releaseFieldLock.value(props.modelValue)
}

const onFocus = () => {
  isFocused.value = true
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

watch(modelValueComputed, (newValue, oldValue) => {
  if (newValue === oldValue) return
  if (collabOptions.value.enabled && (isFocused.value || isOpened.value)) {
    changeFieldData.value(newValue)
  }
})
</script>

<template>
  <ADatetimePicker
    v-model="modelValueComputed"
    :data-cy="dataCy"
    :error-messages="errorMessageComputed"
    :required="requiredComputed"
    :disabled="disabledComputed"
    :label="labelComputed"
    :clearable="clearable"
    @blur="onBlur"
    @focus="onFocus"
    @on-open="onOpen"
    @on-close="onClose"
  >
    <template #append-inner>
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
  </ADatetimePicker>
</template>
