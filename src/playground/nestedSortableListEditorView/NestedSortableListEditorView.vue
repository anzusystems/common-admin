<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { computed, ref } from 'vue'
import ANestedSortableListEditor from '@/labs/listEditor/ANestedSortableListEditor.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import type { NestedPositionHint, NestedTree } from '@/labs/listEditor/types/listEditorTypes'
import type { NestedViewItem } from '@/labs/listEditor/composables/useNestedListEditor'

interface MenuItem extends Record<string, any> {
  id: number
  position: number
  parent: number | null
  title: string
  status?: 'Active' | 'Draft'
  url?: string
}

let nextId = 1000

const statusColor = (status?: string): string => {
  if (status === 'Active') return 'success'
  if (status === 'Draft') return 'warning'
  return 'default'
}

const makeTree = (): NestedTree<MenuItem> => ({
  children: [
    {
      data: { id: 1, position: 1, parent: null, title: 'Home', status: 'Active', url: '/' },
      children: [],
      meta: { dirty: false },
    },
    {
      data: { id: 2, position: 2, parent: null, title: 'News', status: 'Active', url: '/news' },
      children: [
        {
          data: { id: 21, position: 1, parent: 2, title: 'Sport', status: 'Draft', url: '/news/sport' },
          children: [],
          meta: { dirty: false },
        },
        {
          data: { id: 22, position: 2, parent: 2, title: 'Weather', status: 'Active', url: '/news/weather' },
          children: [],
          meta: { dirty: false },
        },
      ],
      meta: { dirty: false },
    },
    {
      data: { id: 3, position: 3, parent: null, title: 'About', status: 'Draft', url: '/about' },
      children: [
        {
          data: { id: 31, position: 1, parent: 3, title: 'Team', status: 'Active', url: '/about/team' },
          children: [],
          meta: { dirty: false },
        },
      ],
      meta: { dirty: false },
    },
    {
      data: { id: 4, position: 4, parent: null, title: 'Contact', status: 'Active', url: '/contact' },
      children: [],
      meta: { dirty: false },
    },
  ],
  meta: { dirty: false },
})

// Deep 5-level tree for the first demo to stress-test arbitrary nesting.
// Levels: Docs (L1) > Guides (L2) > Vue (L3) > Advanced (L4) > Composition (L5).
const makeDeepTree = (): NestedTree<MenuItem> => ({
  children: [
    {
      data: { id: 100, position: 1, parent: null, title: 'Docs', status: 'Active', url: '/docs' },
      children: [
        {
          data: { id: 110, position: 1, parent: 100, title: 'Guides', status: 'Active', url: '/docs/guides' },
          children: [
            {
              data: { id: 111, position: 1, parent: 110, title: 'Vue', status: 'Active', url: '/docs/guides/vue' },
              children: [
                {
                  data: {
                    id: 112,
                    position: 1,
                    parent: 111,
                    title: 'Advanced',
                    status: 'Draft',
                    url: '/docs/guides/vue/advanced',
                  },
                  children: [
                    {
                      data: {
                        id: 113,
                        position: 1,
                        parent: 112,
                        title: 'Composition API',
                        status: 'Draft',
                        url: '/docs/guides/vue/advanced/composition',
                      },
                      children: [],
                      meta: { dirty: false },
                    },
                    {
                      data: {
                        id: 114,
                        position: 2,
                        parent: 112,
                        title: 'Reactivity',
                        status: 'Active',
                        url: '/docs/guides/vue/advanced/reactivity',
                      },
                      children: [],
                      meta: { dirty: false },
                    },
                  ],
                  meta: { dirty: false },
                },
                {
                  data: {
                    id: 115,
                    position: 2,
                    parent: 111,
                    title: 'Basics',
                    status: 'Active',
                    url: '/docs/guides/vue/basics',
                  },
                  children: [],
                  meta: { dirty: false },
                },
              ],
              meta: { dirty: false },
            },
            {
              data: { id: 116, position: 2, parent: 110, title: 'React', status: 'Active', url: '/docs/guides/react' },
              children: [],
              meta: { dirty: false },
            },
          ],
          meta: { dirty: false },
        },
        {
          data: {
            id: 120,
            position: 2,
            parent: 100,
            title: 'Reference',
            status: 'Active',
            url: '/docs/reference',
          },
          children: [],
          meta: { dirty: false },
        },
      ],
      meta: { dirty: false },
    },
    {
      data: { id: 130, position: 2, parent: null, title: 'Blog', status: 'Active', url: '/blog' },
      children: [
        {
          data: { id: 131, position: 1, parent: 130, title: '2026', status: 'Draft', url: '/blog/2026' },
          children: [],
          meta: { dirty: false },
        },
      ],
      meta: { dirty: false },
    },
    {
      data: { id: 140, position: 3, parent: null, title: 'Changelog', status: 'Active', url: '/changelog' },
      children: [],
      meta: { dirty: false },
    },
  ],
  meta: { dirty: false },
})

const basicTree = ref<NestedTree<MenuItem>>(makeDeepTree())
const readonlyTree = ref<NestedTree<MenuItem>>(makeTree())
const callbackTree = ref<NestedTree<MenuItem>>(makeTree())
const errorTree = ref<NestedTree<MenuItem>>(makeTree())
const externalTree = ref<NestedTree<MenuItem>>(makeTree())
const externalMode = ref<'view' | 'reorder'>('view')
const refApiTree = ref<NestedTree<MenuItem>>(makeTree())

const lastLog = ref<string>('')
const log = (msg: string) => {
  lastLog.value = `${new Date().toLocaleTimeString()}  ${msg}`
}

const onBasicAdd = (hint: NestedPositionHint | undefined) => {
  const fresh: MenuItem = {
    id: nextId++,
    position: 0,
    parent: typeof hint?.parentId === 'number' ? hint.parentId : null,
    title: `New #${nextId}`,
    status: 'Draft',
  }
  log(`add hint=${JSON.stringify(hint)} -> ${fresh.id}`)
}

const onBasicAddChild = (vi: NestedViewItem<MenuItem>) => log(`add-child under ${vi.key}`)
const onBasicEdit = (vi: NestedViewItem<MenuItem>) => log(`edit ${vi.key}`)
const onBasicDeleted = (vi: NestedViewItem<MenuItem>) => log(`deleted ${vi.key}`)
const onBasicIndent = (vi: NestedViewItem<MenuItem>) => log(`indent ${vi.key}`)
const onBasicOutdent = (vi: NestedViewItem<MenuItem>) => log(`outdent ${vi.key}`)

const onReorderApplyCallback = async (tree: NestedTree<MenuItem>) => {
  log(`saving tree (${tree.children.length} root nodes)...`)
  await new Promise((r) => setTimeout(r, 800))
  log('saved OK')
}

const failingApply = async (_tree: NestedTree<MenuItem>): Promise<void> => {
  await new Promise((r) => setTimeout(r, 600))
  throw new Error('Server rejected the new tree')
}

// --- imperative ref API demo (mirrors the LinkedListManage migration pattern) ---

interface NestedEditorApi {
  addAfterId: (targetId: number | null, data: MenuItem, childrenAllowed: boolean) => void
  addChildToId: (targetId: number, data: MenuItem, childrenAllowed: boolean) => void
  removeById: (id: number) => void
  updateData: (id: number, data: MenuItem) => void
  resetDirtyBaseline: () => void
}
const refApiRef = ref<NestedEditorApi | null>(null)

const onRefAddRootLast = () => {
  const api = refApiRef.value
  if (!api) return
  const id = nextId++
  // Insert after the last root sibling (or as first root if tree is empty).
  const lastRootId =
    refApiTree.value.children.length > 0
      ? refApiTree.value.children[refApiTree.value.children.length - 1].data.id
      : null
  api.addAfterId(
    lastRootId,
    { id, position: 0, parent: null, title: `Appended #${id}`, status: 'Draft' },
    true,
  )
  log(`addAfterId(last, ${id})`)
}

const onRefAddChildToHome = () => {
  const api = refApiRef.value
  if (!api) return
  const id = nextId++
  api.addChildToId(1, { id, position: 0, parent: 1, title: `Home child #${id}`, status: 'Draft' }, true)
  log(`addChildToId(Home, ${id})`)
}

const onRefDeleteFirst = () => {
  const api = refApiRef.value
  if (!api) return
  const first = refApiTree.value.children[0]
  if (!first) return
  api.removeById(first.data.id)
  log(`removeById(${first.data.id})`)
}

const onRefRenameFirst = () => {
  const api = refApiRef.value
  if (!api) return
  const first = refApiTree.value.children[0]
  if (!first) return
  const newTitle = `${first.data.title} (renamed ${new Date().toLocaleTimeString()})`
  api.updateData(first.data.id, { ...first.data, title: newTitle })
  log(`updateData(${first.data.id})`)
}

const totalCount = computed(() => {
  const walk = (arr: NonNullable<NestedTree<MenuItem>['children']>): number =>
    arr.reduce((acc, n) => acc + 1 + (n.children ? walk(n.children) : 0), 0)
  return walk(basicTree.value.children)
})
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <h2 class="text-headline-medium mt-4 mb-2">
        ANestedSortableListEditor — site menu (drag-and-drop + arrows + indent/outdent)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        <strong>{{ totalCount }}</strong> items across 2 levels.
        On desktop: drag handle appears per row in reorder mode; drag between groups to nest/un-nest
        (respects <code>maxDepth</code>).
        Everywhere: arrows move up/down within the current sibling group; the kebab menu has
        move-to-top / move-to-bottom / indent / outdent.
        Single orange "unsaved" state covers both moved + edited rows.
      </p>
      <ANestedSortableListEditor
        v-model="basicTree"
        title="Documentation tree (5 levels)"
        :max-depth="5"
        show-add-child-button
        show-add-after-action
        @add="onBasicAdd"
        @add-child="onBasicAddChild"
        @edit="onBasicEdit"
        @deleted="onBasicDeleted"
        @indent="onBasicIndent"
        @outdent="onBasicOutdent"
      >
        <template #item-compact="{ raw }: { raw: MenuItem }">
          <span class="menu-title">{{ raw.title }}</span>
        </template>
        <template #item-status="{ raw }: { raw: MenuItem }">
          <VChip
            size="small"
            label
            :color="statusColor(raw.status)"
            variant="tonal"
          >
            {{ raw.status }}
          </VChip>
        </template>
        <template #item="{ raw }: { raw: MenuItem }">
          <div class="d-flex flex-column ga-3">
            <AFormTextField
              v-model="raw.title"
              label="Title"
              required
            />
            <AFormTextField
              v-model="raw.url"
              label="URL"
            />
          </div>
        </template>
      </ANestedSortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ANestedSortableListEditor — readonly detail
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Readonly mode — no edit, delete, add, or reorder toggle. Rows are expandable to show a
        read-only detail body via <code>#item-readonly</code>.
      </p>
      <ANestedSortableListEditor
        v-model="readonlyTree"
        title="Site menu — readonly"
        :max-depth="2"
        readonly
      >
        <template #item-compact="{ raw }: { raw: MenuItem }">
          <span class="menu-title">{{ raw.title }}</span>
        </template>
        <template #item-readonly="{ raw }: { raw: MenuItem }">
          <div class="d-flex flex-column ga-2 text-body-small">
            <div><strong>URL:</strong> {{ raw.url ?? '—' }}</div>
            <div><strong>Status:</strong> {{ raw.status ?? '—' }}</div>
          </div>
        </template>
      </ANestedSortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ANestedSortableListEditor — async <code>onReorderApply</code>
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Apply awaits a simulated 800 ms persist before exiting reorder mode.
      </p>
      <ANestedSortableListEditor
        v-model="callbackTree"
        title="Async apply"
        :max-depth="2"
        :on-reorder-apply="onReorderApplyCallback"
      >
        <template #item-compact="{ raw }: { raw: MenuItem }">
          <span class="menu-title">{{ raw.title }}</span>
        </template>
      </ANestedSortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ANestedSortableListEditor — failing apply (stays in reorder mode)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Apply throws; the component keeps reorder mode open with the error in the toolbar.
      </p>
      <ANestedSortableListEditor
        v-model="errorTree"
        title="Fails on save"
        :max-depth="2"
        :on-reorder-apply="failingApply"
      >
        <template #item-compact="{ raw }: { raw: MenuItem }">
          <span class="menu-title">{{ raw.title }}</span>
        </template>
      </ANestedSortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ANestedSortableListEditor — external mode control via <code>v-model:mode</code>
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Parent controls mode. Current: <strong>{{ externalMode }}</strong>.
      </p>
      <div class="d-flex ga-2 mb-2">
        <VBtn
          :disabled="externalMode === 'reorder'"
          color="primary"
          variant="flat"
          size="small"
          @click="externalMode = 'reorder'"
        >
          Enter reorder mode
        </VBtn>
        <VBtn
          :disabled="externalMode === 'view'"
          variant="outlined"
          size="small"
          @click="externalMode = 'view'"
        >
          Exit reorder mode
        </VBtn>
      </div>
      <ANestedSortableListEditor
        v-model="externalTree"
        v-model:mode="externalMode"
        title="External mode"
        :max-depth="2"
        :show-reorder-toggle="false"
      >
        <template #item-compact="{ raw }: { raw: MenuItem }">
          <span class="menu-title">{{ raw.title }}</span>
        </template>
      </ANestedSortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ANestedSortableListEditor — imperative ref API (migration parity with legacy
        <code>ASortableNested</code>)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        These buttons call <code>addAfterId</code> / <code>addChildToId</code> /
        <code>removeById</code> / <code>updateData</code> on the component ref — same method
        names and signatures as the legacy component. After each call the internal dirty
        baseline is re-captured automatically.
      </p>
      <div class="d-flex ga-2 mb-2 flex-wrap">
        <VBtn
          color="primary"
          variant="flat"
          size="small"
          prepend-icon="mdi-plus"
          @click="onRefAddRootLast"
        >
          addAfterId(last)
        </VBtn>
        <VBtn
          color="primary"
          variant="flat"
          size="small"
          prepend-icon="mdi-plus-box-outline"
          @click="onRefAddChildToHome"
        >
          addChildToId(Home)
        </VBtn>
        <VBtn
          variant="tonal"
          size="small"
          prepend-icon="mdi-pencil"
          @click="onRefRenameFirst"
        >
          updateData(first root)
        </VBtn>
        <VBtn
          color="error"
          variant="outlined"
          size="small"
          prepend-icon="mdi-delete"
          @click="onRefDeleteFirst"
        >
          removeById(first root)
        </VBtn>
      </div>
      <ANestedSortableListEditor
        ref="refApiRef"
        v-model="refApiTree"
        title="Ref API demo"
        :max-depth="2"
      >
        <template #item-compact="{ raw }: { raw: MenuItem }">
          <span class="menu-title">{{ raw.title }}</span>
        </template>
      </ANestedSortableListEditor>

      <div
        v-if="lastLog"
        class="text-body-small text-medium-emphasis mt-4"
      >
        last event: {{ lastLog }}
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped>
.menu-title {
  flex: 1 1 auto;
  font-size: 0.92rem;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
