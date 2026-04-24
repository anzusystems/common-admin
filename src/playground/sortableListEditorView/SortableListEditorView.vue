<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import type { ListViewItem, PositionHint } from '@/labs/listEditor/types/listEditorTypes'

interface FaqItem extends Record<string, any> {
  id: number
  position: number
  title: string
  status: 'Active' | 'Draft'
  answer?: string
}

let nextId = 100

const statusColor = (status: string): string => {
  if (status === 'Active') return 'success'
  if (status === 'Draft') return 'warning'
  return 'default'
}

const makeItems = (): FaqItem[] => [
  {
    id: 1,
    position: 10,
    title: 'How do I reset my password?',
    status: 'Active',
    answer: 'Go to Settings → Security → Reset password.',
  },
  {
    id: 2,
    position: 20,
    title: 'Where can I find the user guide?',
    status: 'Active',
    answer: 'docs.example.com',
  },
  {
    id: 3,
    position: 30,
    title: 'What is the refund policy?',
    status: 'Draft',
    answer: 'Refunds can be requested within 14 days.',
  },
  {
    id: 4,
    position: 40,
    title: 'How to contact support?',
    status: 'Active',
    answer: 'Email support@example.com.',
  },
  {
    id: 5,
    position: 50,
    title: 'How to cancel my subscription?',
    status: 'Active',
    answer: 'Account → Subscription → Cancel.',
  },
]

const basicItems = ref<FaqItem[]>(makeItems())
const callbackItems = ref<FaqItem[]>(makeItems())
const errorItems = ref<FaqItem[]>(makeItems())
const externalToolbarItems = ref<FaqItem[]>(makeItems())
const externalMode = ref<'view' | 'reorder'>('view')

interface Tag extends Record<string, any> {
  id: number
  position: number
  label: string
}
let nextTagId = 100
const chipItems = ref<Tag[]>([
  { id: 1, position: 10, label: 'john.doe' },
  { id: 2, position: 20, label: 'jane.smith' },
  { id: 3, position: 30, label: 'editorial-team' },
  { id: 4, position: 40, label: 'external-contributor' },
])
const chipInput = ref<string>('')
const addChip = () => {
  const label = chipInput.value.trim()
  if (!label) return
  chipItems.value.push({
    id: nextTagId++,
    position: chipItems.value.length * 10,
    label,
  })
  chipInput.value = ''
}

const addAfterItems = ref<FaqItem[]>(makeItems())
const onAddAfter = (hint: PositionHint | undefined) => {
  const fresh: FaqItem = {
    id: nextId++,
    position: 0,
    title: `New #${nextId}`,
    status: 'Draft',
  }
  const anchor = hint?.afterId
    ? addAfterItems.value.findIndex((i) => i.id === hint.afterId)
    : -1
  if (anchor >= 0) {
    addAfterItems.value.splice(anchor + 1, 0, fresh)
    log(`inserted ${fresh.id} after ${hint?.afterId}`)
  } else {
    addAfterItems.value.push(fresh)
    log(`appended ${fresh.id}`)
  }
}

const lastLog = ref<string>('')
const log = (msg: string) => {
  lastLog.value = `${new Date().toLocaleTimeString()}  ${msg}`
}

const onItemSave = async (item: FaqItem) => {
  await new Promise((r) => setTimeout(r, 400))
  log(`saved item ${item.id}: ${item.title}`)
}

const onReorderApplied = (items: FaqItem[]) => {
  log(`applied: ${items.map((i) => i.id).join(' → ')}`)
}

const onReorderApplyCallback = async (items: FaqItem[]) => {
  log(`saving: ${items.map((i) => i.id).join(' → ')}`)
  await new Promise((r) => setTimeout(r, 800))
  log('saved OK')
}

const failingApply = async (_items: FaqItem[]): Promise<void> => {
  await new Promise((r) => setTimeout(r, 600))
  throw new Error('Server rejected the new order')
}

const onDeleteAsync = async (item: FaqItem) => {
  log(`deleting item ${item.id}...`)
  await new Promise((r) => setTimeout(r, 800))
  if (item.id === 3) {
    throw new Error('Backend rejected delete for this item')
  }
  log(`deleted ${item.id}`)
}

const onAdd = () => {
  basicItems.value = [
    ...basicItems.value,
    { id: nextId++, position: 0, title: `New #${nextId}`, status: 'Draft' },
  ]
}

const onEdit = (vi: ListViewItem<FaqItem>) => log(`edit ${vi.key}`)
const onDelete = (vi: ListViewItem<FaqItem>) => log(`delete ${vi.key}`)
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <h2 class="text-headline-medium mt-4 mb-2">
        ASortableListEditor — title + reorder with drag-and-drop (desktop) + arrows (mobile)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        On desktop the drag handle (<code>⋮⋮</code>) appears on each row in reorder mode; drag to
        move. On mobile (≤600 px) arrows are shown instead. Menu always has Move-to-top /
        Move-to-bottom / Delete. Apply commits, Cancel reverts.
      </p>
      <ASortableListEditor
        v-model="basicItems"
        title="Časté otázky (FAQ)"
        update-position
        :position-multiplier="10"
        :on-delete="onDeleteAsync"
        @add="onAdd"
        @edit="onEdit"
        @deleted="onDelete"
        @reorder-applied="onReorderApplied"
      >
        <template #item-compact="{ raw }">
          <span class="faq-title">{{ raw.title }}</span>
        </template>
        <template #item-status="{ raw }">
          <VChip
            size="small"
            label
            :color="statusColor(raw.status)"
            variant="tonal"
          >
            {{ raw.status }}
          </VChip>
        </template>
        <template #item="{ raw }">
          <div class="d-flex flex-column ga-3">
            <AFormTextField
              v-model="raw.title"
              label="Title"
              required
            />
            <AFormTextField
              v-model="raw.answer"
              label="Answer"
            />
          </div>
        </template>
      </ASortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ASortableListEditor — async onReorderApply (loading state on Apply)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Apply awaits a simulated 800 ms persist before exiting reorder mode.
      </p>
      <ASortableListEditor
        v-model="callbackItems"
        title="Steps"
        update-position
        :position-multiplier="10"
        :on-reorder-apply="onReorderApplyCallback"
      >
        <template #item-compact="{ raw }">
          <span class="faq-title">{{ raw.title }}</span>
        </template>
        <template #item-status="{ raw }">
          <VChip
            size="small"
            label
            :color="statusColor(raw.status)"
            variant="tonal"
          >
            {{ raw.status }}
          </VChip>
        </template>
      </ASortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ASortableListEditor — failing onReorderApply (stays in reorder mode, shows error)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Apply throws; the component keeps the reorder mode open with the error in the toolbar.
        User can retry or Cancel.
      </p>
      <ASortableListEditor
        v-model="errorItems"
        title="Fails on save"
        :on-reorder-apply="failingApply"
      >
        <template #item-compact="{ raw }">
          <span class="faq-title">{{ raw.title }}</span>
        </template>
        <template #item-status="{ raw }">
          <VChip
            size="small"
            label
            :color="statusColor(raw.status)"
            variant="tonal"
          >
            {{ raw.status }}
          </VChip>
        </template>
      </ASortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ASortableListEditor — external mode control via <code>v-model:mode</code>
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
      <ASortableListEditor
        v-model="externalToolbarItems"
        v-model:mode="externalMode"
        title="External mode"
        :show-reorder-toggle="false"
      >
        <template #item-compact="{ raw }">
          <span class="faq-title">{{ raw.title }}</span>
        </template>
        <template #item-status="{ raw }">
          <VChip
            size="small"
            label
            :color="statusColor(raw.status)"
            variant="tonal"
          >
            {{ raw.status }}
          </VChip>
        </template>
      </ASortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ASortableListEditor — <code>chips</code> layout (tags / authors)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Flat inline-flex pills. Drag reorders on desktop (always on, no mode toggle).
        Each chip has a built-in close X — no confirm dialog. Use an external input
        above the list for adding.
      </p>
      <div class="d-flex ga-2 mb-2">
        <AFormTextField
          v-model="chipInput"
          label="Add tag"
          hide-details
          @keydown.enter.prevent="addChip"
        />
        <VBtn
          color="primary"
          variant="flat"
          :disabled="!chipInput.trim()"
          @click="addChip"
        >
          Add
        </VBtn>
      </div>
      <ASortableListEditor
        v-model="chipItems"
        title="Authors"
        chips
        :show-add-button="false"
      >
        <template #item-compact="{ raw }">
          <span class="chip-label">{{ raw.label }}</span>
        </template>
      </ASortableListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        ASortableListEditor — <code>showAddAfterAction</code> (extra entry in reorder-mode kebab)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Enter reorder mode (top-right <code>Reorder</code> button), then open any row's
        <code>⋮</code> menu — alongside move-to-top / move-to-bottom / delete, there's a new
        "Add after this" entry. Parent receives <code>@add</code> with <code>{ afterId }</code>
        and splices a new row directly below the anchor.
      </p>
      <ASortableListEditor
        v-model="addAfterItems"
        title="FAQ — add-after menu"
        show-add-after-action
        @add="onAddAfter"
      >
        <template #item-compact="{ raw }">
          <span class="faq-title">{{ raw.title }}</span>
        </template>
        <template #item-status="{ raw }">
          <VChip
            size="small"
            label
            :color="statusColor(raw.status)"
            variant="tonal"
          >
            {{ raw.status }}
          </VChip>
        </template>
      </ASortableListEditor>

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
.faq-title {
  flex: 1 1 auto;
  font-size: 0.92rem;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-label {
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
}
</style>
