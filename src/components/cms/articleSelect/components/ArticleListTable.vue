<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useArticleListActions } from '@/components/cms/articleSelect/composables/articleListActions'
import ArticleTableRowItem from '@/components/cms/articleSelect/components/ArticleTableRowItem.vue'

const { t } = useI18n()

const { onItemClick, articleListItems, loader } = useArticleListActions()
</script>

<template>
  <VTable
    class="a-datatable a-datatable--dialog-sticky-fix"
    fixed-header
  >
    <thead>
      <tr>
        <th class="text-left" />
        <th class="text-left">
          {{ t('common.articleSelect.model.texts.title') }}
        </th>
        <th class="text-left">
          {{ t('common.model.tracking.created') }}
        </th>
      </tr>
    </thead>
    <tbody>
      <ArticleTableRowItem
        v-for="(item, index) in articleListItems"
        :key="item.article.id"
        :index="index"
        :item="item"
        @item-click="onItemClick"
      />
      <tr v-if="!loader && articleListItems.length === 0">
        <td
          colspan="6"
          class="text-center"
        >
          {{ t('common.articleSelect.meta.texts.noItemsFound') }}
        </td>
      </tr>
    </tbody>
  </VTable>
</template>
