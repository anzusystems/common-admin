<script lang="ts" setup>
import type { DocId, IntegerId } from '@/shared/types/common'
import type { ValidationScope } from '@/shared/types/Validation'
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'
import useVuelidate from '@vuelidate/core'
import {
  useDamCachedAuthors,
  useDamCachedAuthorsForRemoteAutocomplete,
} from '@/domains/dam/author/composables/cachedAuthors'
import type { DamAuthor } from '@/domains/dam/author/types/DamAuthor'
import { isArray } from '@/shared/utils/common'
import AFormRemoteAutocompleteWithCached from '@/domains/remoteAutocomplete/components/AFormRemoteAutocompleteWithCached.vue'
import AuthorRemoteAutocompleteCachedAuthorChip from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChip.vue'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import { useAuthorSelectActions } from '@/domains/dam/author/composables/authorActions'
import AuthorCreateButton from '@/domains/dam/author/components/AuthorCreateButton.vue'
import ARow from '@/domains/ui/components/ARow.vue'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import { useAuthorInnerFilter } from '@/domains/dam/author/filter/AuthorFilter'
import { useAclAllowed } from '@/domains/auth/composables/aclAllowed'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import type { DamFieldsDisabledAs } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    modelValue: DocId | null | DocId[] | any
    extSystem: IntegerId
    queueId?: string | undefined
    label?: string | undefined
    required?: boolean | null
    disabled?: boolean | undefined
    multiple?: boolean
    clearable?: boolean
    authorConflicts?: DocId[]
    dataCy?: string
    validationScope?: ValidationScope
    /** How a disabled field looks: author chips (current library behaviour), or the input and its "+" disabled. */
    disabledAs?: DamFieldsDisabledAs
    /** DAM configuration to use. Defaults to the parent component's, else `default`. */
    configName?: string
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
    disabledAs: 'chips',
    configName: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: DocId | null | DocId[]): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    emit('update:modelValue', [...newValue])
  },
})

const search = ref<string>('')
const loadingLocal = ref(false)
const fetchedItemsMinimal = ref<Map<IntegerId | DocId, any>>(new Map())

const { t } = useI18n()

const requiredComputed = computed(() => !!props.required)

const { requiredIf } = useValidate()

const rules = {
  modelValueComputed: {
    required: requiredIf(requiredComputed),
  },
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const v$ = useVuelidate(rules, { modelValueComputed }, { $scope: props.validationScope })

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItemsMinimal } = useAuthorSelectActions(props.extSystem, damConfigName)

const { authorCreateAcl } = useCommonAdminCoreDamOptions(damConfigName)
const createAllowed = useAclAllowed(authorCreateAcl ?? undefined)

const { filterData, filterConfig } = useAuthorInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)

// Authors the input already has are not offered again.
const offeredConflicts = computed(() =>
  (props.authorConflicts ?? []).filter((id) =>
    isArray(modelValueComputed.value) ? !modelValueComputed.value.includes(id) : modelValueComputed.value !== id
  )
)

const addAuthor = async (id: null | DocId | undefined) => {
  if (!id) return
  if (!modelValueComputed.value.includes(id)) {
    modelValueComputed.value = [...modelValueComputed.value, id]
  }
}

const addNewAuthorText = ref('')

const searchChange = (newValue: string) => {
  if (newValue.length > 0) addNewAuthorText.value = removeLastComma(newValue)
}

const { addManualToCachedAuthors } = useDamCachedAuthors(damConfigName)
// The inner input reads this cache only once.
const useCachedOfName = () => useDamCachedAuthorsForRemoteAutocomplete(damConfigName)

const afterCreate = (author: DamAuthor) => {
  addManualToCachedAuthors(author)
  if (isArray(modelValueComputed.value)) {
    modelValueComputed.value = [...modelValueComputed.value, author.id]
    search.value = ''
    return
  }
  modelValueComputed.value = author.id
  search.value = ''
}

const itemSlotIsSelected = (item: DocId) => {
  if (isArray(modelValueComputed.value)) {
    return modelValueComputed.value.includes(item)
  } else if (modelValueComputed.value) {
    return modelValueComputed.value === item
  }
  return false
}

const authorCreateButton = ref<InstanceType<typeof AuthorCreateButton> | null>(null)

const removeLastComma = (value: string) => {
  if (value.endsWith(',')) return value.slice(0, -1)
  return value
}

const onEnterKeyup = () => {
  if (!createAllowed.value) return
  const value = removeLastComma(search.value)
  authorCreateButton.value?.open(value)
}

const onCommaKeyup = () => {
  if (!createAllowed.value) return
  const value = removeLastComma(search.value)
  authorCreateButton.value?.open(value)
}

const showAdd = computed(() => {
  if (!createAllowed.value) return false
  if (loadingLocal.value) return false
  if (search.value.length < 2 || search.value.length > 255) return false
  if (fetchedItemsMinimal.value.size === 0) return true
  return ![...fetchedItemsMinimal.value.values()].some(
    (item) => item.name?.toLowerCase() === search.value!.toLowerCase()
  )
})
</script>

<template>
  <div class="d-flex">
    <ARow
      v-if="disabled && disabledAs === 'chips' && multiple"
      :title="label"
    >
      <AuthorRemoteAutocompleteCachedAuthorChip
        v-for="id in modelValueComputed"
        :id="id"
        :key="id"
        :queue-id="queueId"
        force-rounded
        class="mr-1 mb-1"
      />
    </ARow>
    <ARow
      v-else-if="disabled && disabledAs === 'chips' && !multiple"
      :title="label"
    >
      <AuthorRemoteAutocompleteCachedAuthorChip
        :id="modelValueComputed"
        :key="modelValueComputed"
        :queue-id="queueId"
        force-rounded
      />
    </ARow>
    <AFormRemoteAutocompleteWithCached
      v-else
      v-model="modelValueComputed"
      v-model:search="search"
      v-model:loading-local="loadingLocal"
      v-model:fetched-items-minimal="fetchedItemsMinimal"
      :use-cached="useCachedOfName"
      :v="v$"
      :required="requiredComputed"
      :label="label"
      :fetch-items-minimal="fetchItemsMinimal"
      :multiple="multiple"
      :clearable="clearable"
      :disabled="disabled || undefined"
      filter-by-field="text"
      :filter-sort-by="null"
      :data-cy="dataCy"
      item-title="name"
      item-value="id"
      :min-search-chars="2"
      min-search-text="common.damImage.author.filterMinChars"
      @search-change="searchChange"
      @keyup.enter="onEnterKeyup"
      @keyup.,="onCommaKeyup"
    >
      <template #item="{ props: itemSlotProps, item: itemSlotItem }">
        <VListItem
          v-if="itemSlotItem"
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
              :force-reviewed="itemSlotItem.raw?.raw?.reviewed"
            />
          </template>
        </VListItem>
      </template>
      <!--
        Pass only the chip's close. Its other props (`onMousedown`)
        would stop a press on the chip from opening the list.
      -->
      <template #chip="{ props: chipSlotProps, item: chipSlotItem }">
        <AuthorRemoteAutocompleteCachedAuthorChip
          v-if="chipSlotItem"
          :id="chipSlotItem.value"
          :key="chipSlotItem.value"
          :chip-props="{ 'onClick:close': chipSlotProps['onClick:close'] }"
          :queue-id="queueId"
          :title="chipSlotItem.title"
          force-rounded
        />
      </template>
      <template #append-item>
        <VListItem
          v-if="showAdd"
          class="a-authors-append-item"
        >
          <ABtnSecondary
            size="small"
            :text="addNewAuthorText"
            prepend-icon="mdi-plus-circle"
            @click.stop="onCommaKeyup"
          />
        </VListItem>
      </template>
    </AFormRemoteAutocompleteWithCached>
    <div v-show="!disabled || disabledAs === 'input'">
      <AuthorCreateButton
        v-if="createAllowed"
        ref="authorCreateButton"
        variant="icon"
        :ext-system="extSystem"
        data-cy="add-author"
        :initial-value="addNewAuthorText"
        disable-redirect
        :disabled="disabled"
        @success="afterCreate"
      />
    </div>
  </div>
  <div
    v-if="!disabled && offeredConflicts.length > 0"
    class="d-flex flex-column"
  >
    <div>
      <span class="text-body-small">{{ t('common.damImage.author.conflicts') }}</span>
    </div>
    <div>
      <AuthorRemoteAutocompleteCachedAuthorChipConflicts
        v-for="authorId in offeredConflicts"
        :id="authorId"
        :key="authorId"
        class="mr-1 mt-1"
        @add-author="addAuthor(authorId)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.a-authors-append-item {
  position: sticky;
  bottom: 0;
  // Use the menu surface color. A white bar showed in the dark theme.
  background-color: rgb(var(--v-theme-surface));
  transform: translateY(8px);
}
</style>
