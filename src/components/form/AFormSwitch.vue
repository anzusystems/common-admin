<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import ACollabLockedByUser from '@/components/collab/components/ACollabLockedByUser.vue'
import { isDefined } from '@/utils/common'
import type { CollabComponentConfig, CollabFieldData } from '@/components/collab/types/Collab'
import { useCollabField } from '@/components/collab/composables/collabField'
import type { IntegerIdNullable } from '@/types/common'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    label?: string
    dataCy?: string
    hideLabel?: boolean
    collab?: CollabComponentConfig
    disabled?: boolean
  }>(),
  {
    label: undefined,
    dataCy: undefined,
    hideLabel: false,
    collab: undefined,
    disabled: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
  (e: 'blur', data: boolean): void
  (e: 'focus', data: boolean): void
}>()

// Collaboration
const { collabOptions } = useCommonAdminCollabOptions()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const releaseFieldLock = ref((data: CollabFieldData) => {})
const acquireFieldLock = ref(() => {})
const lockedByUserLocal = ref<IntegerIdNullable>(null)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (collabOptions.value.enabled && isDefined(props.collab)) {
  const {
    releaseCollabFieldLock,
    acquireCollabFieldLock,
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
}

const onClick = () => {
  acquireFieldLock.value()
  setTimeout(() => {
    releaseFieldLock.value(props.modelValue)
  }, 500)
}

const onUpdate = (newValue: boolean) => {
  emit('update:modelValue', newValue)
}
const onBlur = () => {
  emit('blur', props.modelValue)
  releaseFieldLock.value(props.modelValue)
}

const onFocus = () => {
  emit('focus', props.modelValue)
  acquireFieldLock.value()
}

const disabledComputed = computed(() => {
  if (isDefined(props.disabled)) return props.disabled
  return !!lockedByUserLocal.value
})
</script>

<template>
  <VSwitch
    :data-cy="dataCy"
    :model-value="modelValue"
    :disabled="disabledComputed"
    @blur="onBlur"
    @focus="onFocus"
    @update:model-value="onUpdate($event as unknown as boolean)"
    @click.stop="onClick"
  >
    <template
      v-if="!hideLabel"
      #label
    >
      {{ label }}
    </template>
    <template
      v-if="lockedByUserLocal"
      #append
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
  </VSwitch>
</template>
