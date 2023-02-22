<script lang="ts" setup>
import { useAcl } from '@/composables/system/ability'
import { ref, watch, inject } from 'vue'
import { CurrentUserSymbol, CurrentUserType } from '@/AnzuSystemsCommonAdmin'
import type { AclValue } from '@/types/Permission'

const props = withDefaults(
  defineProps<{
    permission: AclValue
    subject?: object
  }>(),
  {
    subject: undefined,
  }
)

const currentUser = inject(CurrentUserSymbol) as CurrentUserType
const { can } = useAcl()
const allowed = ref<boolean>(can(props.permission, props.subject))

watch(currentUser, () => {
  allowed.value = can(props.permission, props.subject)
})
</script>

<template>
  <slot v-if="allowed" />
</template>
