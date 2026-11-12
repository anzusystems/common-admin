<script lang="ts" setup>
import { onMounted } from 'vue'
import AUserSystemPanel from '@/domains/anzuUser/components/AUserSystemPanel.vue'
import type { AnyUserSystemDescriptor } from '@/domains/anzuUser/composables/userSystemDescriptor'
import { useUserCreateFromSource } from '@/domains/anzuUser/composables/userCreateFromSource'
import type { BaseUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'

/**
 * A user page whose system holds no account for the person. It stays inside the tabs and offers
 * to create the account, copying another managed system's record, instead of leaving the page.
 */
const props = defineProps<{
  /** The page's own system. */
  descriptor: AnyUserSystemDescriptor
  userId: IntegerId
  /** The admin's other systems, in order of preference; the first holding the person is copied. */
  sources: AnyUserSystemDescriptor[]
}>()

const emit = defineEmits<{
  /** The account exists now; the page loads it. */
  (e: 'created'): void
}>()

const { source, createEnabled, creatingSystem, loadSource, create } = useUserCreateFromSource({
  userId: () => props.userId,
  sources: () => props.sources,
})

const onCreate = async (target: AnyUserSystemDescriptor, metadata: BaseUser) => {
  if (await create(target, metadata)) emit('created')
}

onMounted(loadSource)
</script>

<template>
  <AUserSystemPanel
    :descriptor="descriptor"
    :user-id="userId"
    :create-enabled="createEnabled"
    :source="source"
    :creating="creatingSystem === descriptor.system"
    @create="onCreate"
  />
</template>
