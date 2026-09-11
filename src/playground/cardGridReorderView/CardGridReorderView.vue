<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { ref } from 'vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'

interface MockImage extends Record<string, any> {
  id: number
  key: string
  position: number
  src: string
  title: string
  description: string
}

const palette = ['#ff8a80', '#ffd180', '#ffff8d', '#ccff90', '#80d8ff', '#b388ff']
const makeSvgThumb = (label: string, color: string): string => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">' +
    `<rect width="320" height="180" fill="${color}"/>` +
    `<text x="160" y="100" text-anchor="middle" font-family="sans-serif" font-size="40" fill="#222">${label}</text>` +
    '</svg>'
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const buildImages = (): MockImage[] =>
  Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    key: `img-${i + 1}`,
    position: i + 1,
    src: makeSvgThumb(String(i + 1), palette[i % palette.length]),
    title: `Image ${i + 1}`,
    description: `Description for image ${i + 1}`,
  }))

const images = ref<MockImage[]>(buildImages())
const editorMode = ref<'view' | 'reorder'>('view')

let nextCardId = 100
const createImage = (): MockImage => {
  const id = nextCardId++
  return {
    id,
    key: `img-${id}`,
    position: 0,
    src: makeSvgThumb(String(id), palette[id % palette.length]),
    title: `Image ${id}`,
    description: '',
  }
}

const reset = () => {
  images.value = buildImages()
  editorMode.value = 'view'
}

const removeAt = (idx: number) => {
  images.value.splice(idx, 1)
}

const lastEvent = ref<string>('')
const log = (msg: string) => {
  lastEvent.value = `${new Date().toLocaleTimeString()}  ${msg}`
}

const onReorderApplied = (items: MockImage[]) => {
  log(`applied: ${items.map((i) => i.id).join(' → ')}`)
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <h2 class="text-headline-medium mt-4 mb-2">
        Card-grid + reorder mode pattern (#view-body slot)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        The editor's header hosts the Reorder / Apply / Cancel buttons; the
        <code>#view-body</code> slot lets you put any content (here, a card grid with form fields)
        in place of the editor's default vertical list while in view mode. Click
        <strong>Reorder</strong> in the editor's header to switch to the bigger-thumbnail sortable
        list.
      </p>
      <p class="text-body-medium text-medium-emphasis mb-4">
        This is the same pattern used by <code>AImageWidgetMultiple</code>.
      </p>

      <div class="pb-2">
        <VBtn
          variant="tonal"
          size="small"
          @click="reset"
        >
          Reset items
        </VBtn>
      </div>

      <ASortableListEditor
        v-model="images"
        v-model:mode="editorMode"
        :factory="createImage"
        get-key="key"
        position="position"
        :show-add-button="false"
        :show-delete-button="false"
        :show-edit-button="false"
        data-cy="reorder-editor"
        @reorder-applied="onReorderApplied"
      >
        <template #view-body>
          <div
            class="card-grid"
            data-cy="card-grid"
          >
            <div
              v-for="(image, index) in images"
              :key="image.key"
              class="card-grid__card"
            >
              <img
                :src="image.src"
                :alt="image.title"
                class="card-grid__thumb"
              />
              <div class="card-grid__body">
                <div class="card-grid__title">
                  {{ image.title }}
                </div>
                <AFormTextarea
                  v-model="image.description"
                  label="Description"
                  hide-details
                />
                <div class="card-grid__actions">
                  <VBtn
                    size="small"
                    variant="text"
                    color="error"
                    @click="removeAt(index)"
                  >
                    Remove
                  </VBtn>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template #item-compact="{ raw }">
          <div class="card-grid-reorder-row">
            <img
              :src="raw.src"
              :alt="raw.title"
              class="card-grid-reorder-row__thumb"
            />
            <div class="card-grid-reorder-row__meta">
              <div class="card-grid-reorder-row__title">
                {{ raw.title }}
              </div>
              <div class="card-grid-reorder-row__desc">
                {{ raw.description }}
              </div>
            </div>
          </div>
        </template>
      </ASortableListEditor>

      <div
        v-if="lastEvent"
        class="text-body-small text-medium-emphasis mt-4"
        data-cy="event-log"
      >
        last event: {{ lastEvent }}
      </div>

      <h3 class="text-title-large mt-6 mb-2">Order (live)</h3>
      <div class="text-body-small text-medium-emphasis">
        {{ images.map((i) => `${i.position}:${i.id}`).join(' · ') }}
      </div>
    </VCardText>
  </VCard>
</template>

<style scoped lang="scss">
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;

  &__card {
    border: 1px solid rgb(var(--v-theme-on-surface) / 12%);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  &__thumb {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
  }

  &__body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__title {
    font-weight: 500;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
  }
}

.card-grid-reorder-row {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 100px;
  padding: 4px 0;

  &__thumb {
    flex: 0 0 auto;
    width: 200px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 4px;
    display: block;
  }

  &__meta {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__title {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__desc {
    font-size: 0.85rem;
    color: rgb(var(--v-theme-on-surface) / 70%);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (width <= 600px) {
    gap: 8px;
    min-height: 72px;

    &__thumb {
      width: 80px;
    }

    &__desc {
      display: none;
    }
  }
}
</style>
