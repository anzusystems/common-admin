<script lang="ts" setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'
import { isUndefined } from '@/utils/common'
import { stringSplitOnFirstOccurrence } from '@/utils/string'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    callbackToTrue: () => Promise<boolean> // return true if successfully changed, otherwise return false
    callbackToFalse: () => Promise<boolean> // return true if successfully changed, otherwise return false
    label?: string | undefined
    hideDetails?: boolean | undefined
    hideLabel?: boolean | undefined
    v?: any
  }>(),
  {
    label: undefined,
    hideDetails: undefined,
    hideLabel: undefined,
    v: null,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
}>()

const { t } = useI18n()

const system = inject<string | undefined>(SystemScopeSymbol, undefined)
const subject = inject<string | undefined>(SubjectScopeSymbol, undefined)

const labelComputed = computed(() => {
  if (!isUndefined(props.label)) return props.label
  if (isUndefined(system) || isUndefined(subject) || isUndefined(props.v?.$path)) return ''
  const { end: path } = stringSplitOnFirstOccurrence(props.v?.$path, '.')
  return t(system + '.' + subject + '.model.' + path)
})

const loading = ref(false)
const hasError = ref(false)
const uniqueId = ref('')

const modelValueComputed = computed(() => {
  return props.modelValue
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const internalModelValue = ref(props.modelValue)

const onClick = async () => {
  if (loading.value) return
  loading.value = true
  hasError.value = false
  if (internalModelValue.value === true) {
    const success = await props.callbackToFalse()
    emit('update:modelValue', !success)
    internalModelValue.value = !success
    if (!success) hasError.value = true
    loading.value = false
    return
  }
  const success = await props.callbackToTrue()
  emit('update:modelValue', success)
  internalModelValue.value = success
  if (!success) hasError.value = true
  loading.value = false
}

watch(modelValueComputed, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    internalModelValue.value = newValue
    hasError.value = false
  }
})

onMounted(() => {
  uniqueId.value = 'a-remote-switch-' + Date.now()
})
</script>

<template>
  <div class="d-flex">
    <VBtn
      :id="uniqueId"
      icon
      class="a-switch-fix-click"
      color="transparent"
      :ripple="false"
      :width="hideLabel ? 36 : undefined"
      :height="36"
      @click.stop="onClick"
    >
      <VSwitch
        v-model="internalModelValue"
        :loading="loading"
        :disabled="loading"
        :hide-details="hideDetails"
        density="compact"
        @click.stop="onClick"
      >
        <template
          v-if="hasError"
          #append
        >
          <VIcon
            icon="mdi-alert"
            class="ml-5 mt-1"
            size="x-small"
            color="error"
          />
        </template>
      </VSwitch>
    </VBtn>
    <label
      v-if="!hideLabel"
      :for="uniqueId"
      class="v-label v-label--clickable"
    >
      {{ labelComputed }}
    </label>
  </div>
</template>

<style lang="scss">
.v-btn.a-switch-fix-click:hover > .v-btn__overlay {
  opacity: 0;
  max-height: 36px;
}
</style>
