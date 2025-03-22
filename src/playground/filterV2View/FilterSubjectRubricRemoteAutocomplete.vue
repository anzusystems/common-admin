<script lang="ts" setup>
import type { Filter, IntegerId } from '@anzusystems/common-admin'
import { AFilterRemoteAutocomplete, cloneDeep, isArray, isNull } from '@anzusystems/common-admin'
import { computed, reactive, ref, watch } from 'vue'
import { makeFilterHelper } from '@/composables/filter/filterHelpers.ts'
import type { ValueObjectOption } from '@/types/ValueObject.ts'
import type { FilterBag } from '@/types/Filter.ts'
import type { Pagination } from '@/types/Pagination.ts'
import { cmsClient } from '@/playground/mock/cmsClient.ts'
import { apiFetchByIds } from '@/services/api/apiFetchByIds.ts'
import { apiFetchList } from '@/services/api/apiFetchList.ts'
import type { IntegerIdNullable } from '@/types/common.ts'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware.ts'

interface Rubric extends AnzuUserAndTimeTrackingAware {
  id: IntegerId
  seo: {
    title: string
    slug: string
    description: string
    postfix: string
    articleMetaTags: any[]
  }
  seoImage: IntegerIdNullable
  texts: {
    title: string
    shortTitle: string
    description: string
  }
  attributes: {
    status: any
  }
  settings: {
    overrideParentContentLockSettings: boolean
    lockAfterPercentage: number
  }
  flags: {
    enableArticleMinutes: boolean // todo check
    enableAdverts: boolean
    enableForum: boolean
    privateArticles: boolean
  }
  analytics: {
    rempPropertyToken: string
    gtmId: string
  }
  site: IntegerIdNullable
  siteGroup: IntegerIdNullable
  designSettings: IntegerIdNullable
  advertSettings: IntegerIdNullable
  linkedList: IntegerIdNullable
  bottomMobileLinkedList: IntegerIdNullable
  primaryNewsletter: IntegerIdNullable
  secondaryNewsletter: IntegerIdNullable
  mainPage: IntegerIdNullable
  _resourceName: 'rubric'
  _system: 'cms'
}

const props = withDefaults(
  defineProps<{
    name: string
    siteId?: IntegerId | IntegerId[] | null
  }>(),
  {
    siteId: () => [],
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: Filter): void
  (e: 'change'): void
}>()

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue: Filter) {
    emit('update:modelValue', cloneDeep(newValue))
  },
})

const forceRerender = ref(0)

const END_POINT = '/adm/v1/rubric'

const fetchRubricListByIds = (ids: IntegerId[]) =>
  apiFetchByIds<Rubric[]>(cmsClient, ids, END_POINT, {}, 'cms', 'rubric')

const fetchRubricList = (pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<Rubric[]>(cmsClient, END_POINT, {}, pagination, filterBag, 'cms', 'rubric')

const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
  const rubrics = await fetchRubricList(pagination, filterBag)

  return <ValueObjectOption<IntegerId>[]>rubrics.map((rubric: Rubric) => ({
    title: rubric.texts.title,
    value: rubric.id,
  }))
}

const fetchItemsByIds = async (ids: IntegerId[]) => {
  const rubrics = await fetchRubricListByIds(ids)

  return <ValueObjectOption<IntegerId>[]>rubrics.map((rubric: Rubric) => ({
    title: rubric.texts.title,
    value: rubric.id,
  }))
}

const makeFilter = makeFilterHelper('cms', 'rubric')

const innerFilter = reactive({
  _elastic: {
    ...makeFilter({ exclude: true }),
  },
  id: {
    ...makeFilter({ name: 'id', variant: 'in' }),
  },
  text: {
    ...makeFilter({ name: 'text' }),
  },
  site: {
    ...makeFilter({ name: 'site', field: 'siteIds', default: [] }),
  },
  siteGroup: {
    ...makeFilter({ name: 'siteGroup', field: 'siteGroupIds', default: [] }),
  },
  desk: {
    ...makeFilter({ name: 'desk', field: 'deskIds', default: [] }),
  },
  linkedList: {
    ...makeFilter({ name: 'linkedList', field: 'linkedListId' }),
  },
})

const siteModel = computed(() => {
  if (isNull(props.siteId)) return []
  if (!isArray(props.siteId)) return [props.siteId]
  return props.siteId
})

watch(
  siteModel,
  (newSiteModel: IntegerId[]) => {
    innerFilter.site.model = newSiteModel
    forceRerender.value++
  },
  { immediate: true }
)
</script>

<template>
  <AFilterRemoteAutocomplete
    :key="forceRerender"
    v-model="modelValueComputed"
    :fetch-items="fetchItems"
    :fetch-items-by-ids="fetchItemsByIds"
    :inner-filter="innerFilter"
    :filter-sort-by="null"
    filter-by-field="text"
  />
</template>
