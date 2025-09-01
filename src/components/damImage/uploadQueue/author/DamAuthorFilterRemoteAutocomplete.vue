<script lang="ts" setup>
import { useAuthorSelectActions } from '@/components/damImage/uploadQueue/author/authorActions'
import { useAuthorInnerFilter } from '@/components/damImage/uploadQueue/author/AuthorFilter'
import type { IntegerId } from '@/types/common'
import { useI18n } from 'vue-i18n'
import AFilterRemoteAutocompleteWithMinimal from '@/labs/filters/AFilterRemoteAutocompleteWithMinimal.vue'
import { provide } from 'vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'

const props = withDefaults(
  defineProps<{
    name: string
    extSystem: IntegerId
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItemsMinimal, fetchItemsMinimalByIds } = useAuthorSelectActions(props.extSystem)

const { filterData, filterConfig } = useAuthorInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)

const { t } = useI18n()
</script>

<template>
  <AFilterRemoteAutocompleteWithMinimal
    :name="name"
    :fetch-items-minimal="fetchItemsMinimal"
    :fetch-items-minimal-by-ids="fetchItemsMinimalByIds"
    filter-by-field="text"
    :filter-sort-by="null"
    @change="emit('change')"
  >
    <template #item="{ props: itemProps, item: itemItem }">
      <VListItem
        v-bind="itemProps"
        title=""
      >
        <VListItemTitle>
          {{ itemItem.title }}
          <VIcon
            v-if="itemItem.raw?.raw?.reviewed || itemItem.raw?.reviewed"
            icon="mdi-shield-check"
            class="text-success ml-1"
            size="small"
            :title="t('common.damImage.author.model.flags.reviewed')"
          />
        </VListItemTitle>
      </VListItem>
    </template>
    <template #chip="{ props: chipProps, item: chipItem }">
      <VChip v-bind="chipProps">
        {{ chipItem.title }}
        <VIcon
          v-if="chipItem.raw?.raw?.reviewed || chipItem.raw?.reviewed"
          icon="mdi-shield-check"
          class="text-success ml-1"
          size="small"
          :title="t('common.damImage.author.model.flags.reviewed')"
        />
      </VChip>
    </template>
  </AFilterRemoteAutocompleteWithMinimal>
</template>
