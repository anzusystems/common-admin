<script lang="ts" setup>
import { ref } from 'vue'
import AUserSystemPanel from '@/labs/anzuUser/AUserSystemPanel.vue'
import type { AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import type { BaseUser } from '@/types/AnzuUser'
import type { IntegerId } from '@/types/common'

const props = defineProps<{
  descriptors: AnyUserSystemDescriptor[]
  userId: IntegerId
  readonly?: boolean
  /** Whether an account created from here would be switched on -- the dialog says so out loud. */
  createEnabled?: boolean
  /** What the owning system holds, to prefill the create form. */
  source?: BaseUser | null
  /** The system a create is currently running for. */
  creatingSystem?: string | null
}>()

const emit = defineEmits<{
  (e: 'create', descriptor: AnyUserSystemDescriptor, user: BaseUser): void
}>()

/**
 * A read-only list of panels, not `AUserSystemOverview`.
 *
 * The overview adds a search, bulk actions and inconsistency detection, and belongs to task 3.
 * Building this out of it would make task 2 depend on task 3, which the plan's task table says it
 * does not.
 */
const panels = ref<InstanceType<typeof AUserSystemPanel>[]>([])

const refreshSystem = (system: string) => {
  const index = props.descriptors.findIndex((descriptor) => descriptor.system === system)
  panels.value[index]?.refresh()
}

defineExpose({
  refresh: () => panels.value.forEach((panel) => panel?.refresh()),
  refreshSystem,
})
</script>

<template>
  <VCard variant="flat">
    <VCardText class="d-flex flex-column ga-4">
      <AUserSystemPanel
        v-for="descriptor in descriptors"
        :key="descriptor.system"
        ref="panels"
        :descriptor="descriptor"
        :user-id="userId"
        :readonly="readonly"
        :create-enabled="createEnabled"
        :source="source"
        :creating="creatingSystem === descriptor.system"
        @create="(target, user) => emit('create', target, user)"
      />
    </VCardText>
  </VCard>
</template>
