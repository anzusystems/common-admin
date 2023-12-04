<script lang="ts" setup>
import type { DocId } from '@/types/common'
import type { ValidationScope } from '@/types/Validation'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useValidate } from '@/validators/vuelidate/useValidate'
import useVuelidate from '@vuelidate/core'
import {
  useDamCachedAuthors,
  useDamCachedAuthorsForRemoteAutocomplete
} from '@/components/damImage/uploadQueue/author/cachedAuthors'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { isArray } from '@/utils/common'
import AFormRemoteAutocompleteWithCached from '@/components/form/AFormRemoteAutocompleteWithCached.vue'
import AuthorRemoteAutocompleteCachedAuthorChip
  from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteCachedAuthorChip.vue'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts
  from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import { useAuthorSelectActions } from '@/components/damImage/uploadQueue/author/authorActions'
import { useAuthorFilter } from '@/components/damImage/uploadQueue/author/AuthorFilter'
import AuthorCreateButton from '@/components/damImage/uploadQueue/author/AuthorCreateButton.vue'

const props = withDefaults(
  defineProps<{
    modelValue: DocId | null | DocId[] | any
    queueId?: string | undefined
    label?: string | undefined
    required?: boolean | null
    disabled?: boolean | undefined
    multiple?: boolean
    clearable?: boolean
    authorConflicts?: DocId[]
    dataCy?: string
    validationScope?: ValidationScope
  }>(),
  {
    label: undefined,
    queueId: undefined,
    required: null,
    disabled: undefined,
    multiple: false,
    clearable: false,
    authorConflicts: undefined,
    dataCy: undefined,
    validationScope: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: DocId | null | DocId[]): void
}>()

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    emit('update:modelValue', [...newValue])
  },
})

const { t } = useI18n()

const requiredComputed = computed(() => !!props.required)

const { requiredIf } = useValidate()

const rules = {
  modelValueComputed: {
    // eslint-disable-next-line vue/no-ref-object-reactivity-loss
    required: requiredIf(requiredComputed.value),
  },
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const v$ = useVuelidate(rules, { modelValueComputed }, { $scope: props.validationScope })

const { fetchItemsMinimal } = useAuthorSelectActions()

const innerFilter = useAuthorFilter()

const addAuthor = async (id: null | DocId | undefined) => {
  if (!id) return
  if (!modelValueComputed.value.includes(id)) {
    modelValueComputed.value = [...modelValueComputed.value, ...[id]]
  }
}

const addNewAuthorText = ref('')

const searchChange = (newValue: string) => {
  if (newValue.length > 0) addNewAuthorText.value = newValue
}

const { addManualToCachedAuthors } = useDamCachedAuthors()

const afterCreate = (author: DamAuthor) => {
  addManualToCachedAuthors(author)
  if (isArray(modelValueComputed.value)) {
    modelValueComputed.value = [...modelValueComputed.value, author.id]
    return
  }
  modelValueComputed.value = author.id
}

const itemSlotIsSelected = (item: DocId) => {
  if (isArray(modelValueComputed.value)) {
    return modelValueComputed.value.includes(item)
  } else if (modelValueComputed.value) {
    return modelValueComputed.value === item
  }
  return false
}

onMounted(() => {
  //
})
</script>

<template>
  <div class="d-flex">
    <AFormRemoteAutocompleteWithCached
      v-model="modelValueComputed"
      :use-cached="useDamCachedAuthorsForRemoteAutocomplete"
      :v="v$"
      :required="requiredComputed"
      :label="label"
      :fetch-items-minimal="fetchItemsMinimal"
      :inner-filter="innerFilter"
      :multiple="multiple"
      :clearable="clearable"
      filter-by-field="text"
      :filter-sort-by="null"
      :data-cy="dataCy"
      item-title="name"
      item-value="id"
      @search-change="searchChange"
    >
      <template #item="{ props: itemSlotProps, item: itemSlotItem }">
        <VListItem
          v-bind="itemSlotProps"
          @click.prevent=""
        >
          <template
            v-if="multiple"
            #prepend
          >
            <VCheckboxBtn
              :model-value="itemSlotIsSelected(itemSlotItem.value)"
              :ripple="false"
            />
          </template>
          <template #title>
            <AuthorRemoteAutocompleteCachedAuthorChip
              :id="itemSlotItem.value"
              :key="itemSlotItem.value"
              :queue-id="queueId"
              :title="itemSlotItem.title"
              text-only
            />
          </template>
        </VListItem>
      </template>
      <template #chip="{ item: chipSlotItem }">
        <AuthorRemoteAutocompleteCachedAuthorChip
          :id="chipSlotItem.value"
          :key="chipSlotItem.value"
          :queue-id="queueId"
          :title="chipSlotItem.title"
          force-rounded
        />
      </template>
    </AFormRemoteAutocompleteWithCached>
    <div>
      <AuthorCreateButton
        variant="icon"
        data-cy="add-author"
        :initial-value="addNewAuthorText"
        disable-redirect
        :disabled="disabled"
        @on-success="afterCreate"
      />
    </div>
  </div>
  <div
    v-if="!disabled && authorConflicts && authorConflicts.length > 0"
    class="d-flex flex-column"
  >
    <div>
      <span class="text-caption">{{ t('coreDam.author.conflicts') }}</span>
    </div>
    <div>
      <AuthorRemoteAutocompleteCachedAuthorChipConflicts
        v-for="authorId in authorConflicts"
        :id="authorId"
        :key="authorId"
        class="mr-1 mt-1"
        @add-author="addAuthor(authorId)"
      />
    </div>
  </div>
</template>
