<script setup lang="ts" generic="TItem extends Record<string, any>">
import { useI18n } from 'vue-i18n'
import LeNestedRowSelf from './LeNestedRow.vue'
import LeDragHandle from '@/labs/listEditor/internal/LeDragHandle.vue'
import LeUnsavedLabel from '@/labs/listEditor/internal/LeUnsavedLabel.vue'
import type {
  ListEditorKey,
  ListEditorValidationState,
} from '@/labs/listEditor/types/listEditorTypes'

// Recursive nested row. Renders a single row plus — when expanded — a group of
// child rows through self-reference, so trees of arbitrary depth share a single
// template. All presentation flags + event callbacks are passed down as the
// `context` and `callbacks` prop bundles (avoids 20+ individual prop-drills).
//
// Types intentionally use `any` on the interior: the strong typing lives on the
// public `ANestedSortableListEditor` wrapper, where generics actually matter.

export type Props = {
  vi: any
  viewItems: any[]
  dragState: any
  context: any
  callbacks: any
}
const props = defineProps<Props>()

// Self-reference cast to any breaks the TypeScript circular type inference that
// Vue's template compiler triggers when a `<script setup generic>` component
// imports itself for recursion. The runtime behaviour is unaffected.

const LeNestedRow = LeNestedRowSelf as any

const { t } = useI18n()

const GROUP_CLASS = 'a-nested-list-editor__group'
const HANDLE_CLASS = 'a-le-drag-handle'

const anchorName = (key: ListEditorKey): string => `--row-${String(key).replace(/\W/g, '_')}`

// Delegate to the parent editor's resolver so the registry + getValidationState
// prop apply consistently. Falls back to reading raw.validationState if context
// doesn't supply one.
const resolveValidation = (raw: TItem): ListEditorValidationState => {
  if (typeof props.context.resolveValidation === 'function') {
    return props.context.resolveValidation(raw, props.vi.key, props.vi.index)
  }
  const v = raw.validationState
  if (v === 'valid' || v === 'invalid' || v === 'warning') return v
  return null
}

const buildSlotProps = () => props.context.buildSlotProps(props.vi)

const directChildren = (): any[] => props.viewItems.filter((v) => v.parentKey === props.vi.key)
</script>

<template>
  <div
    :class="[
      'a-le-row-wrapper',
      {
        'a-le-row-wrapper--drop-disabled': dragState !== null && dragState.sourceKey === vi.key,
      },
    ]"
    :data-id="String(vi.key)"
    role="treeitem"
    :aria-level="vi.depth + 1"
    :tabindex="context.keyboardNav ? context.keyboardNav.rowTabindex(vi.key) : undefined"
    @keydown="context.keyboardNav ? context.keyboardNav.handleKeydown(vi.key, $event) : undefined"
  >
    <div
      :class="[
        'a-le-row',
        vi.depth > 0 ? 'a-le-row--child' : null,
        {
          'a-le-row--editing': vi.editing,
          'a-le-row--expanded': vi.expanded,
          'a-le-row--unsaved': vi.unsaved,
          'a-le-row--reorder': context.reorderMode,
          'a-le-row--grabbed': context.keyboardNav && context.keyboardNav.isGrabbed(vi.key),
          'a-le-row--clickable': context.isRowClickable(vi),
          'a-le-row--drop-source': dragState !== null && dragState.sourceKey === vi.key,
          [`a-le-row--validation-${resolveValidation(vi.raw)}`]: resolveValidation(vi.raw) !== null,
        },
      ]"
      :style="{
        '--nested-depth': vi.depth,
        'anchor-name': anchorName(vi.key),
        '--parent-anchor': vi.parentKey !== null ? anchorName(vi.parentKey) : 'none',
      }"
    >
      <slot
        name="before-item"
        v-bind="buildSlotProps()"
      />

      <div
        class="a-le-row-header"
        @click="callbacks.onRowClick(vi)"
      >
        <LeDragHandle
          v-if="context.dragEnabled"
          :class="HANDLE_CLASS"
        />

        <!-- Expand toggle — a small triangular caret rendered uniformly for both
             root and nested rows. For leaf rows (no children) the toggle is
             hidden via `visibility: hidden` so the column stays aligned. -->
        <button
          v-if="context.showExpandToggle && vi.childrenAllowed"
          type="button"
          :class="[
            'a-nested-list-editor__tree-toggle',
            {
              'a-nested-list-editor__tree-toggle--empty': !vi.hasChildren,
              'a-nested-list-editor__tree-toggle--open': vi.childrenExpanded,
            },
          ]"
          :aria-label="vi.childrenExpanded ? t('common.sortable.close') : t('common.sortable.edit')"
          @click.stop="vi.hasChildren && callbacks.onChevronClick(vi)"
        >
          <span class="a-nested-list-editor__tree-toggle-caret" />
        </button>
        <!-- Spacer for leaf rows that have no caret, so titles align with
             parents having one. -->
        <span
          v-else-if="context.showExpandToggle"
          class="a-nested-list-editor__tree-toggle a-nested-list-editor__tree-toggle--spacer"
          aria-hidden="true"
        />

        <div class="a-le-row-main">
          <slot
            name="item-compact"
            v-bind="buildSlotProps()"
          >
            <span class="a-le-title">
              {{ context.resolveCompactText(vi.raw, vi.key) }}
            </span>
          </slot>
          <!-- Visible only inside the SortableJS drag clone — signals that the
               item being moved carries a subtree so the user realises the whole
               branch will follow. Sits right after the title. Hidden in the
               normal DOM via CSS. -->
          <span
            v-if="vi.hasChildren"
            class="a-nested-list-editor__drag-count"
            aria-hidden="true"
          >
            <VIcon
              icon="mdi-file-tree"
              size="14"
            />
            +{{ vi.childrenCount }}
          </span>
          <LeUnsavedLabel v-if="vi.unsaved" />
        </div>

        <div
          v-if="!context.reorderMode"
          class="a-le-status"
        >
          <slot
            name="item-status"
            v-bind="buildSlotProps()"
          >
            <span
              v-if="
                context.statusField &&
                  vi.raw[context.statusField] != null &&
                  vi.raw[context.statusField] !== ''
              "
              class="a-le-status-badge"
            >
              {{ vi.raw[context.statusField] }}
            </span>
          </slot>
        </div>

        <div class="a-le-actions">
          <slot
            name="item-actions"
            v-bind="buildSlotProps()"
          >
            <template v-if="context.reorderMode">
              <VBtn
                icon
                size="small"
                variant="text"
                density="comfortable"
                :disabled="vi.firstInParent"
                class="mx-1 a-le-action a-le-action--up"
                @click.stop="callbacks.moveUp(vi.key)"
              >
                <VIcon
                  icon="mdi-arrow-up"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                  :text="t('common.sortable.moveUp')"
                />
              </VBtn>
              <VBtn
                icon
                size="small"
                variant="text"
                density="comfortable"
                :disabled="vi.lastInParent"
                class="mx-1 a-le-action a-le-action--down"
                @click.stop="callbacks.moveDown(vi.key)"
              >
                <VIcon
                  icon="mdi-arrow-down"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                  :text="t('common.sortable.moveDown')"
                />
              </VBtn>
              <VBtn
                icon
                size="small"
                variant="text"
                density="comfortable"
                :active="false"
                class="mx-1 a-le-action a-le-action--menu"
              >
                <VIcon
                  icon="mdi-dots-vertical"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                  :text="t('common.sortable.more')"
                />
                <VMenu activator="parent">
                  <VList density="compact">
                    <VListItem
                      :disabled="vi.firstInParent"
                      @click.stop="callbacks.moveTop(vi.key)"
                    >
                      <template #prepend>
                        <VIcon icon="mdi-arrow-collapse-up" />
                      </template>
                      <VListItemTitle>{{ t('common.sortable.moveToTop') }}</VListItemTitle>
                    </VListItem>
                    <VListItem
                      :disabled="vi.lastInParent"
                      @click.stop="callbacks.moveBottom(vi.key)"
                    >
                      <template #prepend>
                        <VIcon icon="mdi-arrow-collapse-down" />
                      </template>
                      <VListItemTitle>{{ t('common.sortable.moveToBottom') }}</VListItemTitle>
                    </VListItem>
                    <VListItem
                      v-if="context.showMoveToPosition && (!vi.firstInParent || !vi.lastInParent)"
                      @click.stop="callbacks.openMoveToPosition(vi)"
                    >
                      <template #prepend>
                        <VIcon icon="mdi-target" />
                      </template>
                      <VListItemTitle>
                        {{ t('common.sortable.moveToPosition.action') }}
                      </VListItemTitle>
                    </VListItem>
                    <VListItem
                      v-if="context.showChangeParent"
                      @click.stop="callbacks.openChangeParent(vi)"
                    >
                      <template #prepend>
                        <VIcon icon="mdi-folder-move-outline" />
                      </template>
                      <VListItemTitle>
                        {{ t('common.sortable.changeParent.action') }}
                      </VListItemTitle>
                    </VListItem>
                    <VListItem
                      :disabled="!vi.canIndent"
                      @click.stop="callbacks.indent(vi)"
                    >
                      <template #prepend>
                        <VIcon icon="mdi-format-indent-increase" />
                      </template>
                      <VListItemTitle>{{ t('common.sortable.indent') }}</VListItemTitle>
                    </VListItem>
                    <VListItem
                      :disabled="!vi.canOutdent"
                      @click.stop="callbacks.outdent(vi)"
                    >
                      <template #prepend>
                        <VIcon icon="mdi-format-indent-decrease" />
                      </template>
                      <VListItemTitle>{{ t('common.sortable.outdent') }}</VListItemTitle>
                    </VListItem>
                    <VListItem
                      v-if="context.showDeleteButton && context.canInteract"
                      @click.stop="callbacks.onDeleteClick(vi)"
                    >
                      <template #prepend>
                        <VIcon
                          icon="mdi-trash-can-outline"
                          color="error"
                        />
                      </template>
                      <VListItemTitle class="text-error">
                        {{ t('common.sortable.delete') }}
                      </VListItemTitle>
                    </VListItem>
                  </VList>
                </VMenu>
              </VBtn>
            </template>
            <template v-else>
              <VBtn
                v-if="context.showEditButton && context.canInteract"
                icon
                size="small"
                variant="tonal"
                color="primary"
                density="comfortable"
                class="mx-1 a-le-action a-le-action--edit"
                @click.stop="callbacks.onEditClick(vi)"
              >
                <VIcon
                  icon="mdi-pencil-outline"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                  :text="t('common.sortable.edit')"
                />
              </VBtn>
              <VBtn
                v-if="context.showDeleteButton && context.canInteract"
                icon
                size="small"
                variant="text"
                density="comfortable"
                class="mx-1 a-le-action a-le-action--delete"
                @click.stop="callbacks.onDeleteClick(vi)"
              >
                <VIcon
                  icon="mdi-trash-can-outline"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                  :text="t('common.sortable.delete')"
                />
              </VBtn>
              <VBtn
                v-if="
                  context.canInteract &&
                    ((context.showAddChildButton && vi.canAddChild) || context.showAddAfterAction)
                "
                icon
                size="small"
                variant="text"
                density="comfortable"
                :active="false"
                class="mx-1 a-le-action a-le-action--menu"
              >
                <VIcon
                  icon="mdi-dots-vertical"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                  :text="t('common.sortable.more')"
                />
                <VMenu activator="parent">
                  <VList density="compact">
                    <VListItem
                      v-if="context.showAddAfterAction"
                      @click.stop="callbacks.onAddAfterClick(vi)"
                    >
                      <template #prepend>
                        <VIcon icon="mdi-playlist-plus" />
                      </template>
                      <VListItemTitle>
                        {{ t('common.sortable.addAfter') }}
                      </VListItemTitle>
                    </VListItem>
                    <VListItem
                      v-if="context.showAddChildButton && vi.canAddChild"
                      @click.stop="callbacks.onAddChildClick(vi)"
                    >
                      <template #prepend>
                        <VIcon icon="mdi-subdirectory-arrow-right" />
                      </template>
                      <VListItemTitle>
                        {{ t('common.sortable.addChild') }}
                      </VListItemTitle>
                    </VListItem>
                  </VList>
                </VMenu>
              </VBtn>
            </template>
          </slot>
        </div>
      </div>

      <!-- Inline edit body — status badge intentionally NOT rendered here,
           the compact header's status is enough; stacking it in the form body
           was visually noisy. -->
      <template v-if="vi.editing && !context.reorderMode && $slots.item">
        <div class="a-le-row-body">
          <div class="a-le-form">
            <slot
              name="item"
              v-bind="buildSlotProps()"
            />
          </div>
        </div>
        <slot
          name="item-footer"
          v-bind="buildSlotProps()"
        >
          <div
            v-if="context.showInlineSaveFooter"
            class="a-le-row-footer"
          >
            <div class="a-le-row-footer-spacer" />
            <VBtn
              variant="text"
              :disabled="vi.loading"
              @click.stop="callbacks.onCancelClick(vi)"
            >
              {{ t('common.button.cancel') }}
            </VBtn>
            <VBtn
              color="primary"
              variant="flat"
              prepend-icon="mdi-check"
              :disabled="vi.loading"
              @click.stop="callbacks.onSaveClick(vi)"
            >
              {{ t('common.button.save') }}
            </VBtn>
          </div>
        </slot>
      </template>

      <div
        v-else-if="vi.expanded && !context.reorderMode && $slots['item-readonly']"
        class="a-le-row-body"
      >
        <div class="a-le-form">
          <slot
            name="item-readonly"
            v-bind="buildSlotProps()"
          />
        </div>
      </div>

      <slot
        name="after-item"
        v-bind="buildSlotProps()"
      />
    </div>

    <!-- Recursive children — any depth level. The `::before` on this wrapper
         renders the single continuous vertical tree line at the parent's
         chevron column (see CSS). One line per group = no per-row gaps. -->
    <div
      v-if="vi.hasChildren && vi.childrenExpanded"
      class="a-nested-list-editor__children"
      :style="{ '--parent-depth': vi.depth }"
    >
      <div
        :class="[GROUP_CLASS]"
        :data-parent-id="String(vi.key)"
      >
        <LeNestedRow
          v-for="child in directChildren()"
          :key="String(child.key)"
          :vi="child"
          :view-items="viewItems"
          :drag-state="dragState"
          :context="context"
          :callbacks="callbacks"
        >
          <template #item="slotScope">
            <slot
              name="item"
              v-bind="slotScope"
            />
          </template>
          <template #item-compact="slotScope">
            <slot
              name="item-compact"
              v-bind="slotScope"
            />
          </template>
          <template #item-readonly="slotScope">
            <slot
              name="item-readonly"
              v-bind="slotScope"
            />
          </template>
          <template #item-status="slotScope">
            <slot
              name="item-status"
              v-bind="slotScope"
            />
          </template>
          <template #item-footer="slotScope">
            <slot
              name="item-footer"
              v-bind="slotScope"
            />
          </template>
          <template #item-actions="slotScope">
            <slot
              name="item-actions"
              v-bind="slotScope"
            />
          </template>
          <template #before-item="slotScope">
            <slot
              name="before-item"
              v-bind="slotScope"
            />
          </template>
          <template #after-item="slotScope">
            <slot
              name="after-item"
              v-bind="slotScope"
            />
          </template>
        </LeNestedRow>
      </div>
    </div>
  </div>
</template>
