<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import AFilterString from '@/components/filter/AFilterString.vue'
import { useArticleListActions } from '@/components/cms/articleSelect/composables/articleListActions'

const { t } = useI18n()
const { filter, fetchArticleList, resetArticleList, filterTouch, filterUnTouch, filterIsTouched } =
  useArticleListActions()

const submitFilter = () => {
  filterUnTouch()
  fetchArticleList()
}

const resetFilter = () => {
  resetArticleList()
  filterUnTouch()
}

const onAnyFilterUpdate = () => {
  filterTouch()
}
</script>

<template>
  <div class="subject-select-filter">
    <div class="subject-select-filter__content">
      <VForm
        name="search2"
        class="px-2 pt-4"
        @submit.prevent="submitFilter"
      >
        <!--        <VCol cols="12">-->
        <!--          <FilterSiteRemoteAutocomplete-->
        <!--            v-model="filter.site"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <!--        <VCol cols="12">-->
        <!--          <FilterRubricRemoteAutocomplete-->
        <!--            v-model="filter.rubric"-->
        <!--            :site-filter="filter.site"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <!--        <VCol cols="12">-->
        <!--          <AFilterString-->
        <!--            v-model="filter.id"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <!--        <VCol cols="12">-->
        <!--          <AFilterString-->
        <!--            v-model="filter.docId"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <VCol cols="12">
          <AFilterString
            v-model="filter.text"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
        <!--        <VCol cols="12">-->
        <!--          <AFilterDatetimePicker-->
        <!--            v-model="filter.publicPublishedAtFrom"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <!--        <VCol cols="12">-->
        <!--          <AFilterDatetimePicker-->
        <!--            v-model="filter.publicPublishedAtUntil"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <!--        <VCol cols="12">-->
        <!--          <AFilterValueObjectOptionsSelect-->
        <!--            v-model="filter.discriminator"-->
        <!--            :items="articleDiscriminatorOptions"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <!--        <VCol cols="12">-->
        <!--          <AFilterDatetimePicker-->
        <!--            v-model="filter.modifiedAtFrom"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <!--        <VCol cols="12">-->
        <!--          <AFilterDatetimePicker-->
        <!--            v-model="filter.modifiedAtUntil"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <!--        <VCol cols="12">-->
        <!--          <FilterUserRemoteAutocomplete-->
        <!--            v-model="filter.owners"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
        <!--        <VCol cols="12">-->
        <!--          <FilterAuthorRemoteAutocomplete-->
        <!--            v-model="filter.articleAuthors"-->
        <!--            @update:model-value="onAnyFilterUpdate"-->
        <!--          />-->
        <!--        </VCol>-->
      </VForm>
    </div>
    <div class="subject-select-filter__actions">
      <VBtn
        color="primary"
        class="mx-2"
        :variant="filterIsTouched ? 'flat' : 'text'"
        size="small"
        @click.stop="submitFilter"
      >
        {{ t('common.button.submitFilter') }}
      </VBtn>
      <VBtn
        class="px-2"
        color="light"
        min-width="36px"
        variant="flat"
        size="small"
        @click.stop="resetFilter"
      >
        <VIcon icon="mdi-filter-remove-outline" />
        <VTooltip
          activator="parent"
          location="bottom"
        >
          {{ t('common.button.resetFilter') }}
        </VTooltip>
      </VBtn>
    </div>
  </div>
</template>
