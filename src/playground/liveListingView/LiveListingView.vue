<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import ALiveListingPill from '@/domains/filters/datatable/components/ALiveListingPill.vue'
import ADatetime from '@/domains/ui/datetime/components/ADatetime.vue'
import {
  LIVE_LISTING_INTERVAL,
  useLiveListing,
  type LiveListingProbeOptions,
} from '@/domains/filters/datatable/composables/useLiveListing'
import { usePagination, type Pagination } from '@/domains/api/composables/pagination'
import { SortOrder } from '@/domains/api/types/SortOrder'
import { useFetchAuthorList } from '@/domains/dam/author/api/authorApi'
import type { DamAuthor } from '@/domains/dam/author/types/DamAuthor'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useAlerts } from '@/domains/system/composables/alerts'
import { damClient } from '@/playground/mock/coreDamClient'
import { useAuthorListFilter } from '@/playground/tableView/authorFilter'

// A list of a plain API, without backend signals: the live listing probes its newest records on a timer and the
// list changes only when the user clicks the pill. DAM authors have text ids (DocId), so the newest are found by
// `createdAt` and a record counts as new while it has not been listed (`unseen`), not by comparing ids.

const ROWS = 20
const EXT_SYSTEM_ID = 1

const { showErrorsDefault } = useAlerts()
const { endPointAuthor } = useCommonAdminCoreDamOptions('default')
const { filterData, filterConfig } = useAuthorListFilter()
const { pagination } = usePagination('createdAt', SortOrder.Desc, { rowsPerPage: ROWS })
const { execute: fetchAuthors } = useFetchAuthorList(damClient, endPointAuthor, EXT_SYSTEM_ID)

const items = ref<DamAuthor[]>([])
const loading = ref(false)

// Its own request and pagination: a probe leaves the shown list and its pagination alone.
const probe = ({ limit, signal }: LiveListingProbeOptions) => {
  const probePagination = ref<Pagination>({
    ...pagination.value,
    page: 1,
    rowsPerPage: limit,
    sortBy: { key: 'createdAt', order: SortOrder.Desc },
  })
  const { execute } = useFetchAuthorList(damClient, endPointAuthor, EXT_SYSTEM_ID)

  return execute(probePagination, filterData, filterConfig, { signal, report: false })
}

const loadList = async () => {
  loading.value = true
  try {
    items.value = await fetchAuthors(pagination, filterData, filterConfig)
    // Page 1 sorted newest first: the list itself tells what the user has seen.
    liveListing.markLoaded(items.value, { newestFirst: true })
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    loading.value = false
  }
}

const liveListing = useLiveListing<DamAuthor>({
  probe,
  key: (author) => author.id,
  newness: 'unseen',
  probeLimit: ROWS,
  interval: LIVE_LISTING_INTERVAL,
  reload: async () => {
    pagination.value = { ...pagination.value, page: 1 }
    await loadList()
  },
})
const { count, failed } = liveListing

onMounted(() => {
  void loadList()
})
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <p>
        Live listing of a plain API, without signals: the newest DAM authors are probed every
        {{ LIVE_LISTING_INTERVAL.visibleMs / 1000 }} s (every {{ LIVE_LISTING_INTERVAL.hiddenMs / 1000 }} s in a hidden
        browser tab) and right after returning to the tab. Create an author in DAM: the pill shows it, the list changes
        only after the click.
      </p>
      <p class="text-medium-emphasis">New records counted: {{ count }}</p>
      <ALiveListingPill
        :count="count"
        :max="liveListing.max"
        :failed="failed"
        @click="liveListing.apply()"
      />
      <VTable density="compact">
        <thead>
          <tr>
            <th>Name</th>
            <th>Identifier</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && items.length === 0">
            <td colspan="3">Loading…</td>
          </tr>
          <tr
            v-for="author in items"
            :key="author.id"
          >
            <td>{{ author.name }}</td>
            <td>{{ author.identifier }}</td>
            <td><ADatetime :date-time="author.createdAt" /></td>
          </tr>
        </tbody>
      </VTable>
    </VCardText>
  </VCard>
</template>
