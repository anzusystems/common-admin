<script lang="ts" setup>
import type { Filter } from '@/types/Filter'
import { useAuthorSelectActions } from '@/components/damImage/uploadQueue/author/authorActions'
import { useAuthorFilter } from '@/components/damImage/uploadQueue/author/AuthorFilter'
import type { IntegerId } from '@/types/common'
import { useI18n } from 'vue-i18n'
import AFilterRemoteAutocompleteWithMinimal from '@/components/filter/AFilterRemoteAutocompleteWithMinimal.vue'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
  }>(),
  {}
)

const modelValue = defineModel<Filter>({ required: true })

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItemsMinimal, fetchItemsMinimalByIds } = useAuthorSelectActions(props.extSystem)

const innerFilter = useAuthorFilter()

const { t } = useI18n()
</script>

<template>
  <AFilterRemoteAutocompleteWithMinimal
    v-model="modelValue"
    :fetch-items-minimal="fetchItemsMinimal"
    :fetch-items-minimal-by-ids="fetchItemsMinimalByIds"
    :inner-filter="innerFilter"
    filter-by-field="text"
    :filter-sort-by="null"
  >
    <template #item="{ props: itemProps, item }">
      <VListItem
        v-bind="itemProps"
        title=""
      >
        <VListItemTitle>
          {{ item.title }}
          <VIcon
            v-if="item.raw.raw.reviewed"
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
          v-if="chipItem.raw.raw.reviewed"
          icon="mdi-shield-check"
          class="text-success ml-1"
          size="small"
          :title="t('common.damImage.author.model.flags.reviewed')"
        />
      </VChip>
    </template>
  </AFilterRemoteAutocompleteWithMinimal>
</template>
