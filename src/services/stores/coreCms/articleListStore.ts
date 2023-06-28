import { acceptHMRUpdate, defineStore } from 'pinia'
import type { DocId, IntegerId } from '@/types/common'
import { computed, ref } from 'vue'
import type { ArticleKind } from '@/types/coreCms/ArticleKind'

export interface ArticleListItem {
  article: ArticleKind
  selected: boolean
}

export const useArticleListStore = defineStore('commonAdminCoreCmsArticleListStore', () => {
  const articleListItems = ref<Array<ArticleListItem>>([])
  const loader = ref(false)
  const selectedArticles = ref<Map<IntegerId, ArticleListItem>>(new Map())
  const singleMode = ref(false)
  const minCount = ref(0)
  const maxCount = ref(0)

  function showLoader() {
    loader.value = true
  }

  function hideLoader() {
    loader.value = false
  }

  function setSingleMode(value: boolean) {
    singleMode.value = value
  }

  function setMinCount(value: number) {
    minCount.value = value
  }

  function setMaxCount(value: number) {
    maxCount.value = value
  }

  function setList(items: ArticleKind[]) {
    articleListItems.value = items.map((item) => {
      return {
        article: item,
        selected: false,
      }
    })
  }

  function appendList(items: ArticleKind[]) {
    const articles = items.map((article) => {
      return {
        article: article,
        selected: false,
      }
    })
    articleListItems.value = articleListItems.value.concat(articles)
  }

  function toggleSelectedByIndex(index: number) {
    if (!articleListItems.value[index]) return

    if (!singleMode.value && isSelectedMax.value && !articleListItems.value[index].selected) {
      return
    }

    articleListItems.value[index].selected = !articleListItems.value[index].selected

    if (singleMode.value && articleListItems.value[index].selected) {
      unselectAllExcept(index)
      clearSelected()
      addToSelected(articleListItems.value[index])
      return
    }

    if (!singleMode.value && articleListItems.value[index].selected) {
      addToSelected(articleListItems.value[index])
      return
    }

    removeFromSelected(articleListItems.value[index].article.id)
  }

  function unselectAllExcept(ignoreIndex: number) {
    const items = articleListItems.value
    for (let i = 0; i < items.length; i++) {
      if (items[i].selected && i !== ignoreIndex) {
        items[i].selected = false
      }
    }
  }

  function clearSelected() {
    selectedArticles.value.clear()
  }

  function addToSelected(articleItem: ArticleListItem) {
    if (!selectedArticles.value.has(articleItem.article.id)) {
      selectedArticles.value.set(articleItem.article.id, articleItem)
    }
  }

  function removeFromSelected(id: IntegerId) {
    if (selectedArticles.value.has(id)) {
      selectedArticles.value.delete(id)
    }
  }

  function getSelectedDocIds(): DocId[] {
    const docIds: Array<DocId> = []
    for (const value of selectedArticles.value.values()) {
      docIds.push(value.article.docId)
    }
    return docIds
  }

  function getSelectedIds(): IntegerId[] {
    return Array.from(selectedArticles.value.keys())
  }

  const isSelectedMax = computed(() => {
    return selectedCount.value >= maxCount.value
  })

  const selectedCount = computed(() => {
    return selectedArticles.value.size
  })

  function reset() {
    articleListItems.value = []
    loader.value = false
    clearSelected()
  }

  return {
    articleListItems,
    loader,
    selectedArticles,
    singleMode,
    minCount,
    maxCount,
    selectedCount,
    setSingleMode,
    setMinCount,
    setMaxCount,
    showLoader,
    hideLoader,
    setList,
    appendList,
    toggleSelectedByIndex,
    getSelectedDocIds,
    getSelectedIds,
    clearSelected,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useArticleListStore, import.meta.hot))
}
