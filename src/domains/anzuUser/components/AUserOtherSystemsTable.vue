<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import AUserSystemPanel from '@/domains/anzuUser/components/AUserSystemPanel.vue'
import type { AnyUserSystemDescriptor } from '@/domains/anzuUser/composables/userSystemDescriptor'
import { useUserCreateFromSource } from '@/domains/anzuUser/composables/userCreateFromSource'
import type { BaseUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'

const props = withDefaults(
  defineProps<{
    /** The systems this admin does not manage, one row each. */
    descriptors: AnyUserSystemDescriptor[]
    userId: IntegerId
    /** Where an account created from a row copies from, in order of preference; see `useUserCreateFromSource`. */
    sources: AnyUserSystemDescriptor[]
    readonly?: boolean
  }>(),
  {
    readonly: false,
  }
)

const { source, createEnabled, creatingSystem, loadSource, create } = useUserCreateFromSource({
  userId: () => props.userId,
  sources: () => props.sources,
})

/**
 * A read-only list of panels, not `AUserSystemOverview`. The overview adds search, bulk
 * actions and inconsistency detection, and building on it would make task 2 depend on task 3.
 */
const panels = ref<InstanceType<typeof AUserSystemPanel>[]>([])

const refreshSystem = (system: string) => {
  const index = props.descriptors.findIndex((descriptor) => descriptor.system === system)
  panels.value[index]?.refresh()
}

const onCreate = async (target: AnyUserSystemDescriptor, metadata: BaseUser) => {
  if (await create(target, metadata)) refreshSystem(target.system)
}

onMounted(loadSource)

defineExpose({
  refresh: () => {
    void loadSource()
    panels.value.forEach((panel) => panel?.refresh())
  },
  refreshSystem,
  /** The source record, for a page that names the person. */
  source,
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
        @create="onCreate"
      />
    </VCardText>
  </VCard>
</template>
