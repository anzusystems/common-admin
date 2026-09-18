<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from 'vue'
import ACard from '@/components/ACard.vue'
import type { AxiosClientFn } from '@/labs/api/client'
import ALogDetail from '@/labs/log/ALogDetail.vue'
import { useLogDetailActions } from '@/labs/log/logActions'
import type { LogPaths, LogTypeType } from '@/labs/log/logType'
import { isNull } from '@/utils/common'

const props = defineProps<{
  client: AxiosClientFn
  system: string
  /** From the route. A log id means nothing without the store it came from. */
  type: LogTypeType
  id: string
  logPaths: LogPaths
}>()

// Read once: the page keys this view on `${system}/${type}/${id}`, so a change remounts it.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { log, detailLoading, fetchData, cancel } = useLogDetailActions({
  client: props.client,
  system: props.system,
  logPaths: props.logPaths,
  type: props.type,
})

onMounted(() => {
  fetchData(props.id)
})

onBeforeUnmount(() => {
  cancel()
})
</script>

<template>
  <ACard :loading="detailLoading">
    <VCardText>
      <ALogDetail
        v-if="!isNull(log)"
        :log="log"
      />
    </VCardText>
  </ACard>
</template>
