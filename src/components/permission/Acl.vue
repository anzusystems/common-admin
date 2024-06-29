<script lang="ts" setup generic="TAclValue extends AclValue">
import { computed, onMounted, ref, watch } from 'vue'
import type { AclValue } from '@/types/Permission'
import { defineAuth } from '@/composables/auth/defineAuth'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    permission: TAclValue
    subject?: object
  }>(),
  {
    subject: undefined,
  }
)

const allowed = ref<boolean>(false)

const system = computed(() => {
  const parts = props.permission.split('_')
  return parts[0] || ''
})

onMounted(() => {
  const { can, useCurrentUser } = defineAuth<AclValue>(system.value)

  const { currentUser } = useCurrentUser(system.value)

  watch(
    currentUser,
    (newValue) => {
      if (!isUndefined(newValue)) {
        allowed.value = can(props.permission, props.subject)
      }
    },
    {
      immediate: true,
    }
  )
})
</script>

<template>
  <slot v-if="allowed" />
</template>
