<script lang="ts" setup>
import type { AFormFieldValidation } from '@/shared/types/Validation'
import { computed, inject, ref, watch, unref } from 'vue'
import { stringSplitOnFirstOccurrence } from '@/shared/utils/string'
import { cloneDeep, isDefined, isNull, isUndefined } from '@/shared/utils/common'
import { SubjectScopeKey, SystemScopeKey } from '@/shared/injectionKeys'
import { useI18n } from 'vue-i18n'
import ACollabLockedByUser from '@/domains/collab/components/ACollabLockedByUser.vue'
import { useCollabField } from '@/domains/collab/composables/collabField'
import type { CollabComponentConfig, CollabFieldData } from '@/domains/collab/types/Collab'
import type { IntegerIdNullable } from '@/shared/types/common'
import { useCommonAdminCollabOptions } from '@/domains/collab/composables/commonAdminCollabOptions'

const props = withDefaults(
  defineProps<{
    modelValue: any
    items: any[]
    label?: string
    errorMessage?: string
    required?: boolean
    v?: AFormFieldValidation | null
    hideLabel?: boolean
    multiple?: boolean
    hideDetails?: boolean
    clearable?: boolean
    dataCy?: string
    collab?: CollabComponentConfig
    disabled?: boolean
    readonly?: boolean
  }>(),
  {
    label: undefined,
    errorMessage: undefined,
    required: undefined,
    v: null,
    hideLabel: false,
    multiple: false,
    hideDetails: false,
    clearable: false,
    dataCy: '',
    collab: undefined,
    disabled: undefined,
    readonly: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: any): void
  (e: 'blur', data: any): void
  (e: 'focus', data: any): void
}>()

const hasNullOption = computed(() => (props.items ?? []).some((item) => isNull(item) || isNull(item?.value)))

const modelValue = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    // VAutocomplete drops the selection when its search text is emptied, emitting null even when
    // not clearable. A tri-state select lists null as a real option, so there null must pass through.
    if (!props.clearable && !props.multiple && !hasNullOption.value && isNull(newValue) && !isNull(props.modelValue))
      return
    emit('update:modelValue', cloneDeep<any>(newValue))
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

const system = inject<string | undefined>(SystemScopeKey, undefined)
const subject = inject<string | undefined>(SubjectScopeKey, undefined)

const { t } = useI18n()

const isFocused = ref(false)

const onBlur = () => {
  isFocused.value = false
  emit('blur', props.modelValue)
  props.v?.$touch()
  releaseFieldLock.value(props.modelValue)
}

const onFocus = () => {
  isFocused.value = true
  emit('focus', props.modelValue)
  acquireFieldLock.value()
}

const errorMessageComputed = computed(() => {
  if (isDefined(props.errorMessage)) return [props.errorMessage]
  if (props.v?.$errors?.length) return props.v.$errors.map((item) => unref(item.$message))
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

const multipleComputedVuetifyTypeFix = computed(() => {
  if (props.multiple === false) return false
  return true as unknown as undefined
})

watch(
  modelValue,
  async (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (collabOptions.value.enabled && isFocused.value) {
      changeFieldData.value(newValue)
    }
  },
  { immediate: true }
)
</script>

<template>
  <VAutocomplete
    v-model="modelValue"
    :items="items"
    item-title="title"
    item-value="value"
    :multiple="multipleComputedVuetifyTypeFix"
    :disabled="disabledComputed"
    :readonly="readonly"
    :clearable="clearable"
    :error-messages="errorMessageComputed"
    :data-cy="dataCy"
    autocomplete="off"
    @blur="onBlur"
    @focus="onFocus"
  >
    <template #label>
      <span v-if="!hideLabel"
        >{{ labelComputed
        }}<span
          v-if="requiredComputed"
          class="a-required-mark"
      /></span>
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
  </VAutocomplete>
</template>
