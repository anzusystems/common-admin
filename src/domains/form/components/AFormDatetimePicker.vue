<script lang="ts" setup>
import type { AFormFieldValidation } from '@/shared/types/Validation'
import { computed, inject, nextTick, ref, watch, unref } from 'vue'
import { useI18n } from 'vue-i18n'
import { SubjectScopeKey, SystemScopeKey } from '@/shared/injectionKeys'
import { isDefined, isUndefined } from '@/shared/utils/common'
import { stringSplitOnFirstOccurrence } from '@/shared/utils/string'
import type { DatetimeUTCNullable, IntegerIdNullable } from '@/shared/types/common'
import type { CollabComponentConfig, CollabFieldData } from '@/domains/collab/types/Collab'
import { useCollabField } from '@/domains/collab/composables/collabField'
import ACollabLockedByUser from '@/domains/collab/components/ACollabLockedByUser.vue'
import { useCommonAdminCollabOptions } from '@/domains/collab/composables/commonAdminCollabOptions'
import ADatetimePicker from '@/domains/ui/datetime/components/ADatetimePicker.vue'
import type { DatetimePickerType } from '@/shared/utils/datetimePickerValue'

const props = withDefaults(
  defineProps<{
    modelValue: DatetimeUTCNullable | undefined
    type?: DatetimePickerType
    label?: string
    errorMessage?: string
    required?: boolean
    v?: AFormFieldValidation | null
    dataCy?: string
    clearable?: boolean
    collab?: CollabComponentConfig
    disabled?: boolean
    readonly?: boolean
  }>(),
  {
    type: 'datetime',
    label: undefined,
    errorMessage: undefined,
    required: undefined,
    v: null,
    dataCy: undefined,
    clearable: false,
    collab: undefined,
    disabled: undefined,
    readonly: undefined,
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
  const { releaseCollabFieldLock, changeCollabFieldData, acquireCollabFieldLock, lockedByUser } = useCollabField(
    props.collab.room,
    props.collab.field
  )
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
}

const isOpened = ref(false)
const isFocused = ref(false)

const onOpen = () => {
  isOpened.value = true
  acquireFieldLock.value()
}

const onClose = () => {
  isOpened.value = false
  // The picker emits close before its watchers flush the picked value into the model.
  nextTick(() => {
    releaseFieldLock.value(props.modelValue)
  })
}

const { t } = useI18n()

const system = inject<string | undefined>(SystemScopeKey, undefined)
const subject = inject<string | undefined>(SubjectScopeKey, undefined)

const onBlur = () => {
  props.v?.$touch()
  // The picker commits a typed value in a watcher that runs after this event, so releasing the lock
  // here would hand the room the previous value - and clearing `isFocused` would skip the change.
  nextTick(() => {
    isFocused.value = false
    emit('blur', isUndefined(props.modelValue) ? null : props.modelValue)
    if (isOpened.value === false) releaseFieldLock.value(props.modelValue)
  })
}

const onFocus = () => {
  isFocused.value = true
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
    :type="type"
    :data-cy="dataCy"
    :error-messages="errorMessageComputed"
    :required="requiredComputed"
    :disabled="disabledComputed"
    :readonly="readonly"
    :label="labelComputed"
    :clearable="clearable"
    v-bind="$attrs"
    @blur="onBlur"
    @focus="onFocus"
    @open="onOpen"
    @close="onClose"
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
