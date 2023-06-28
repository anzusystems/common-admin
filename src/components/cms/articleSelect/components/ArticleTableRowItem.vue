<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import ADatetime from '@/components/ADatetime.vue'
import type { ArticleListItem } from '@/services/stores/coreCms/articleListStore'

const props = withDefaults(
  defineProps<{
    index: number
    item: ArticleListItem
  }>(),
  {
  }
)

const emit = defineEmits<{
  (e: 'itemClick', data: { articleId: IntegerId; index: number }): void
}>()

const onItemClick = () => {
  emit('itemClick', { articleId: props.item.article.id, index: props.index })
}
</script>

<template>
  <tr
    class="dam-image-table__row a-table__row"
    :class="{ 'a-table__row--selected': item.selected }"
    @click.stop.exact="onItemClick"
  >
    <td>
      <VIcon
        v-if="item.selected"
        icon="mdi-checkbox-outline"
        :size="20"
      />
      <VIcon
        v-else
        icon="mdi-checkbox-blank-outline"
        :size="20"
      />
    </td>
    <td>
      {{ item.article.texts.title }}
    </td>
    <td>
      <ADatetime :date-time="item.article.createdAt" />
    </td>
  </tr>
</template>
