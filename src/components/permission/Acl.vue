<script lang="ts" setup>
import { useAcl } from '@/composables/system/ability'
import { inject, ref, watch } from 'vue'
import type { CurrentUserType } from '@/AnzuSystemsCommonAdmin'
import type { AclValue } from '@/types/Permission'
import { CurrentUserSymbol } from '@/components/injectionKeys'

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
