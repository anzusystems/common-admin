<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { ref } from 'vue'
import AListEditor from '@/labs/listEditor/AListEditor.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import type { ListEditorApi } from '@/labs/listEditor/composables/useListEditor'
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
    position: 1,
    title: 'How do I reset my password?',
    status: 'Active',
    answer: 'Go to Settings → Security → Reset password.',
  },
  {
    id: 2,
    position: 2,
    title: 'Where can I find the user guide?',
    status: 'Active',
    answer: 'The user guide is available at docs.example.com.',
  },
  {
    id: 3,
    position: 3,
    title: 'What is the refund policy?',
    status: 'Draft',
    answer: 'Refunds can be requested within 14 days of purchase.',
  },
  {
    id: 4,
    position: 4,
    title: 'How to contact support?',
    status: 'Active',
    answer: 'Email support@example.com or call +1-555-0199.',
  },
]

const inlineItems = ref<FaqItem[]>(makeItems())
const readonlyItems = ref<FaqItem[]>(makeItems())
const lazyItems = ref<FaqItem[]>(
  makeItems().map((i) => ({ id: i.id, position: i.position, title: i.title, status: i.status })),
)
const refEditorItems = ref<FaqItem[]>(makeItems())

interface Keyword extends Record<string, any> {
  id: number
  label: string
}
let nextKeywordId = 100
const chipItems = ref<Keyword[]>([
  { id: 1, label: 'breaking-news' },
  { id: 2, label: 'sport' },
  { id: 3, label: 'culture' },
  { id: 4, label: 'longer-tag-that-wraps' },
  { id: 5, label: 'economy' },
  { id: 6, label: 'local' },
])
const chipReadonlyItems = ref<Keyword[]>([
  { id: 10, label: 'climate' },
  { id: 11, label: 'policy' },
  { id: 12, label: 'renewables' },
])
const chipInput = ref<string>('')
const onChipAdd = () => {
  const label = chipInput.value.trim()
  if (!label) return
  chipItems.value.push({ id: nextKeywordId++, label })
  chipInput.value = ''
}
const twoRowsItems = ref<FaqItem[]>([
  {
    id: 50,
    position: 1,
    title:
      'A longer FAQ title that may wrap onto two visible lines when shown in the always-two-rows layout variant',
    status: 'Active',
    answer: 'Detailed answer goes here.',
  },
  {
    id: 51,
    position: 2,
    title: 'Short title',
    status: 'Draft',
    answer: 'Shorter answer.',
  },
  {
    id: 52,
    position: 3,
    title: 'Another multi-line FAQ title that demonstrates the two-row compact layout',
    status: 'Active',
    answer: 'Another answer.',
  },
])

const editorRef = ref<ListEditorApi<FaqItem> | null>(null)

const lastLog = ref<string>('')
const log = (msg: string) => {
  lastLog.value = `${new Date().toLocaleTimeString()}  ${msg}`
}

const onInlineItemSave = async (item: FaqItem) => {
  await new Promise((r) => setTimeout(r, 400))
  log(`saved item ${item.id}: ${item.title}`)
}

const onInlineAdd = (hint: PositionHint | undefined) => {
  const fresh: FaqItem = {
    id: nextId++,
    position: 0,
    title: `New #${nextId}`,
    status: 'Draft',
  }
  const anchor = hint?.afterId ? inlineItems.value.findIndex((i) => i.id === hint.afterId) : -1
  if (anchor >= 0) {
    inlineItems.value.splice(anchor + 1, 0, fresh)
  } else {
    inlineItems.value.push(fresh)
  }
}

const loadingKeys = ref<Set<number>>(new Set())
const onLazyEdit = async (vi: ListViewItem<FaqItem>) => {
  if (vi.raw.answer !== undefined) return
  loadingKeys.value.add(vi.raw.id)
  await new Promise((r) => setTimeout(r, 900))
  const idx = lazyItems.value.findIndex((i) => i.id === vi.raw.id)
  if (idx !== -1) {
    lazyItems.value[idx].answer =
      `Lazy-loaded answer for #${vi.raw.id} at ${new Date().toLocaleTimeString()}`
  }
  loadingKeys.value.delete(vi.raw.id)
}

const onRefAdd = (hint: PositionHint | undefined) => {
  if (!editorRef.value) return
  editorRef.value.addItem(
    {
      id: nextId++,
      position: 0,
      title: `New question #${nextId}`,
      status: 'Draft',
    },
    hint,
  )
}

const onDeleteAsync = async (item: FaqItem) => {
  log(`deleting item ${item.id} via BE...`)
  await new Promise((r) => setTimeout(r, 900))
  if (item.id === 3) {
    throw new Error('Backend rejected delete for this item')
  }
  log(`deleted item ${item.id}`)
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <h2 class="text-headline-medium mt-4 mb-2">
        AListEditor — inline edit (title + status chip + Close vs Cancel distinction)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Click a row to activate. Close (X) keeps your changes. Cancel rolls back to the snapshot
        taken when you opened the row. Save commits via
        <code>onItemSave</code>. Only one row can be edited at a time.
      </p>
      <AListEditor
        v-model="inlineItems"
        title="Časté otázky (FAQ)"
        :on-delete="onDeleteAsync"
        @add="onInlineAdd"
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
      </AListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        AListEditor — readonly with #item-readonly slot (click to expand detail view)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Component is <code>readonly</code>. Click a row to expand and see the detail in a read-only
        form rendered via the <code>#item-readonly</code> slot. Close (X) collapses. No Save /
        Cancel footer.
      </p>
      <AListEditor
        v-model="readonlyItems"
        title="FAQ — read only"
        readonly
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
        <template #item-readonly="{ raw }">
          <div class="d-flex flex-column ga-3">
            <div>
              <div class="text-body-small text-medium-emphasis mb-1">
                Title
              </div>
              <div class="text-body-medium">
                {{ raw.title }}
              </div>
            </div>
            <div>
              <div class="text-body-small text-medium-emphasis mb-1">
                Answer
              </div>
              <div class="text-body-medium">
                {{ raw.answer }}
              </div>
            </div>
          </div>
        </template>
      </AListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        AListEditor — lazy-loaded detail (async fetch on edit)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Rows only have title + status initially. Clicking a row triggers an async fetch (simulated
        900 ms) to load the answer. Spinner shows while loading, then the form renders.
      </p>
      <AListEditor
        v-model="lazyItems"
        title="FAQ — lazy detail"
        :loading-keys="loadingKeys"
        :on-item-save="onInlineItemSave"
        @edit="onLazyEdit"
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
          <div
            v-if="loadingKeys.has(raw.id) && raw.answer === undefined"
            class="d-flex align-center justify-center pa-6"
          >
            <VProgressCircular
              indeterminate
              color="primary"
              size="28"
            />
            <span class="ml-3 text-body-medium text-medium-emphasis">Loading detail…</span>
          </div>
          <div
            v-else
            class="d-flex flex-column ga-3"
          >
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
      </AListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        AListEditor — two-rows compact layout (<code>two-rows="always"</code>)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        For lists with longer titles or secondary metadata. Title wraps up to two lines;
        meta/actions on the bottom row.
      </p>
      <AListEditor
        v-model="twoRowsItems"
        title="FAQ — two-rows layout"
        two-rows="always"
        :on-item-save="onInlineItemSave"
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
      </AListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        AListEditor — imperative API via template ref
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Caller calls <code>editorRef.addItem(data, hint)</code> on the component; add button at the
        bottom triggers it.
      </p>
      <AListEditor
        ref="editorRef"
        v-model="refEditorItems"
        title="FAQ — imperative ref"
        @add="onRefAdd"
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
      </AListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        AListEditor — <code>chips</code> layout (flat, no drag)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Flat inline-flex chip pills. No drag (non-sortable variant). Each chip has a built-in close
        X — no confirm dialog. Add via an external input above. Chips wrap to the next line when the
        container is narrow.
      </p>
      <div class="d-flex ga-2 mb-2">
        <AFormTextField
          v-model="chipInput"
          label="Add keyword"
          hide-details
          @keydown.enter.prevent="onChipAdd"
        />
        <VBtn
          color="primary"
          variant="flat"
          :disabled="!chipInput.trim()"
          @click="onChipAdd"
        >
          Add
        </VBtn>
      </div>
      <AListEditor
        v-model="chipItems"
        title="Keywords"
        chips
        :show-add-button="false"
      >
        <template #item-compact="{ raw }">
          <span class="chip-label">{{ raw.label }}</span>
        </template>
      </AListEditor>

      <h2 class="text-headline-medium mt-8 mb-2">
        AListEditor — <code>chips</code> readonly (no close X, display-only)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Passing <code>readonly</code> or <code>:show-delete-button="false"</code> suppresses the
        close X on each chip.
      </p>
      <AListEditor
        v-model="chipReadonlyItems"
        title="Tags (readonly)"
        chips
        readonly
        :show-add-button="false"
      >
        <template #item-compact="{ raw }">
          <span class="chip-label">{{ raw.label }}</span>
        </template>
      </AListEditor>

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

.faq-title--two-rows {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.35;
}

.chip-label {
  font-size: 0.82rem;
  font-weight: 500;
  white-space: nowrap;
}
</style>
