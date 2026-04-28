<script setup lang="ts" generic="TItem extends Record<string, any>">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  ListEditorKey,
  NestedTree,
  NestedTreeNode,
} from '@/labs/listEditor/types/listEditorTypes'

export interface Props<TItem extends Record<string, any>> {
  tree: NestedTree<TItem>
  sourceKey: ListEditorKey | null
  keyField: string
  maxDepth: number
  resolveLabel: (raw: TItem, key: ListEditorKey) => string
  calculateSubtreeDepth: (node: NestedTreeNode<TItem>) => number
}

interface Candidate {
  key: ListEditorKey | null
  depth: number
  label: string
  hasChildren: boolean
  disallowed: boolean
  reason: 'self' | 'descendant' | 'maxDepth' | 'currentParent' | null
}

const props = defineProps<Props<TItem>>()

const emit = defineEmits<{
  confirm: [parentId: ListEditorKey | null, position: 'first' | 'last']
}>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()

const selectedKey = ref<ListEditorKey | null | undefined>(undefined)
const placement = ref<'first' | 'last'>('last')

watch(open, (now) => {
  if (now) {
    selectedKey.value = undefined
    placement.value = 'last'
  }
})

// Walk the source's subtree to gather descendant keys (cycle prevention).
const descendantKeys = computed<Set<ListEditorKey>>(() => {
  const out = new Set<ListEditorKey>()
  if (props.sourceKey === null) return out
  const walk = (nodes: NestedTreeNode<TItem>[]): boolean => {
    for (const n of nodes) {
      const k = n.data[props.keyField] as ListEditorKey
      if (k === props.sourceKey) {
        const collect = (sub: NestedTreeNode<TItem>[]) => {
          for (const s of sub) {
            out.add(s.data[props.keyField] as ListEditorKey)
            if (s.children?.length) collect(s.children)
          }
        }
        if (n.children?.length) collect(n.children)
        return true
      }
      if (n.children?.length && walk(n.children)) return true
    }
    return false
  }
  walk(props.tree.children)
  return out
})

const sourceNode = computed<NestedTreeNode<TItem> | null>(() => {
  if (props.sourceKey === null) return null
  const find = (nodes: NestedTreeNode<TItem>[]): NestedTreeNode<TItem> | null => {
    for (const n of nodes) {
      if ((n.data[props.keyField] as ListEditorKey) === props.sourceKey) return n
      if (n.children?.length) {
        const hit = find(n.children)
        if (hit) return hit
      }
    }
    return null
  }
  return find(props.tree.children)
})

// `currentParentKey` = parent of the source row (null if source is at root).
// We exclude this from candidates because moving to "the same parent" is not a
// "change parent" operation (use Move-to-position instead).
const currentParentKey = computed<ListEditorKey | null | undefined>(() => {
  if (props.sourceKey === null) return undefined
  const find = (
    nodes: NestedTreeNode<TItem>[],
    parentKey: ListEditorKey | null,
  ): ListEditorKey | null | undefined => {
    for (const n of nodes) {
      if ((n.data[props.keyField] as ListEditorKey) === props.sourceKey) return parentKey
      if (n.children?.length) {
        const hit = find(n.children, n.data[props.keyField] as ListEditorKey)
        if (hit !== undefined) return hit
      }
    }
    return undefined
  }
  return find(props.tree.children, null)
})

const candidates = computed<Candidate[]>(() => {
  const out: Candidate[] = []
  const subtreeDepth = sourceNode.value
    ? props.calculateSubtreeDepth(sourceNode.value)
    : 1

  out.push({
    key: null,
    depth: 0,
    label: t('common.sortable.changeParent.rootLabel'),
    hasChildren: props.tree.children.length > 0,
    disallowed: currentParentKey.value === null,
    reason: currentParentKey.value === null ? 'currentParent' : null,
  })

  const walk = (nodes: NestedTreeNode<TItem>[], depth: number) => {
    for (const n of nodes) {
      const key = n.data[props.keyField] as ListEditorKey
      let disallowed = false
      let reason: Candidate['reason'] = null
      if (key === props.sourceKey) {
        disallowed = true
        reason = 'self'
      } else if (descendantKeys.value.has(key)) {
        disallowed = true
        reason = 'descendant'
      } else if (currentParentKey.value !== undefined && currentParentKey.value === key) {
        disallowed = true
        reason = 'currentParent'
      } else if (depth + 1 + subtreeDepth > props.maxDepth) {
        disallowed = true
        reason = 'maxDepth'
      }
      out.push({
        key,
        depth: depth + 1,
        label: props.resolveLabel(n.data as TItem, key),
        hasChildren: !!(n.children && n.children.length > 0),
        disallowed,
        reason,
      })
      if (n.children?.length) walk(n.children, depth + 1)
    }
  }
  walk(props.tree.children, 0)
  return out
})

const validCandidates = computed(() => candidates.value.filter((c) => !c.disallowed))

const selectedCandidate = computed<Candidate | null>(() =>
  selectedKey.value === undefined
    ? null
    : candidates.value.find((c) => c.key === selectedKey.value) ?? null,
)

const showPlacementPicker = computed<boolean>(
  () => !!selectedCandidate.value && selectedCandidate.value.hasChildren,
)

const onCandidateClick = (c: Candidate) => {
  if (c.disallowed) return
  selectedKey.value = c.key
}

const onConfirm = () => {
  if (!selectedCandidate.value) return
  emit('confirm', selectedCandidate.value.key, placement.value)
  open.value = false
}

const onCancel = () => {
  open.value = false
}

const indent = (depth: number): string => `${depth * 16}px`

const reasonLabel = (reason: Candidate['reason']): string => {
  if (reason === 'maxDepth') return t('common.sortable.changeParent.errorMaxDepth')
  return ''
}
</script>

<template>
  <VDialog
    v-model="open"
    max-width="540"
    persistent
  >
    <VCard>
      <VCardTitle>
        {{ t('common.sortable.changeParent.title') }}
      </VCardTitle>

      <VCardText
        v-if="validCandidates.length === 0"
        class="text-body-medium"
      >
        <VAlert
          type="info"
          variant="tonal"
          density="compact"
        >
          <strong>{{ t('common.sortable.changeParent.noTargetsTitle') }}</strong>
          <div>{{ t('common.sortable.changeParent.noTargetsText') }}</div>
        </VAlert>
      </VCardText>

      <template v-else>
        <VCardText class="pb-1">
          <VList
            density="compact"
            class="le-change-parent__list"
          >
            <VListItem
              v-for="c in candidates"
              :key="c.key === null ? '__root__' : String(c.key)"
              :disabled="c.disallowed"
              :active="selectedKey === c.key"
              :title="c.label"
              :subtitle="reasonLabel(c.reason)"
              :style="{ paddingInlineStart: indent(c.depth) }"
              :data-disallowed="c.disallowed ? 'true' : 'false'"
              :data-reason="c.reason ?? ''"
              @click="onCandidateClick(c)"
            >
              <template #prepend>
                <VIcon
                  v-if="c.key === null"
                  icon="mdi-folder-home-outline"
                  size="18"
                />
                <VIcon
                  v-else-if="c.hasChildren"
                  icon="mdi-folder-outline"
                  size="18"
                />
                <VIcon
                  v-else
                  icon="mdi-file-outline"
                  size="18"
                />
              </template>
            </VListItem>
          </VList>
        </VCardText>

        <VCardText
          v-if="showPlacementPicker"
          class="pt-0"
        >
          <div class="text-body-medium mb-2">
            {{
              t('common.sortable.changeParent.placementHeading', {
                label: selectedCandidate?.label ?? '',
              })
            }}
          </div>
          <VRadioGroup
            v-model="placement"
            density="compact"
            hide-details
          >
            <VRadio
              value="first"
              :label="t('common.sortable.changeParent.placeFirst')"
            />
            <VRadio
              value="last"
              :label="t('common.sortable.changeParent.placeLast')"
            />
          </VRadioGroup>
        </VCardText>
      </template>

      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          @click="onCancel"
        >
          {{ t('common.sortable.reorderCancel') }}
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          :disabled="!selectedCandidate || selectedCandidate.disallowed"
          @click="onConfirm"
        >
          {{ t('common.sortable.changeParent.confirm') }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style lang="scss" scoped>
.le-change-parent__list {
  max-height: 340px;
  overflow-y: auto;
}
</style>
