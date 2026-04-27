<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import ACard from '@/components/ACard.vue'
import ARow from '@/components/ARow.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type {
  ListEditorKey,
  ListViewItem,
} from '@/labs/listEditor/types/listEditorTypes'
import { useNestedUnsavedKeys } from '@/labs/listEditor/composables/useNestedUnsavedKeys'
import QuizManageQuestionAnswers from '@/playground/quizManageView/QuizManageQuestionAnswers.vue'
import {
  type Quiz,
  type QuizQuestion,
  createQuizQuestion,
  useQuizValidation,
} from '@/playground/quizManageView/quizMock'

type ReorderMode = 'view' | 'reorder'

const props = defineProps<{
  modelValue: Quiz
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', data: Quiz): void
}>()
const selectedValue = computed({
  get() {
    return props.modelValue
  },
  set(newValue: Quiz) {
    emit('update:modelValue', newValue)
  },
})
const mode = defineModel<ReorderMode>('mode', { default: 'view' })
const unsavedKeys = defineModel<Set<ListEditorKey>>('unsavedKeys', {
  default: () => new Set<ListEditorKey>(),
})
const answersUnsavedKeys = defineModel<Set<ListEditorKey>>('answersUnsavedKeys', {
  default: () => new Set<ListEditorKey>(),
})

const answerKeys = useNestedUnsavedKeys()
watch(answerKeys.merged, (now) => {
  answersUnsavedKeys.value = now
})

const { v$ } = useQuizValidation(selectedValue)

const getQuestionValidationState = (
  _: QuizQuestion,
  __: ListEditorKey,
  index: number,
) => {
  const errors =
    v$.value.quiz.questions.$each?.$response?.$errors?.[index]
  return errors && errors.length > 0 ? 'invalid' : null
}

const onAddQuestion = () => {
  const newQuestion = createQuizQuestion()
  newQuestion.quiz = selectedValue.value.id
  newQuestion.position =
    (selectedValue.value.questions.at(-1)?.position ?? 0) + 1
  selectedValue.value.questions.push(newQuestion)
}
const onDeleteQuestion = (vi: ListViewItem<QuizQuestion>) => {
  selectedValue.value.questions.splice(vi.index, 1)
}
onMounted(() => {
  if (selectedValue.value.questions.length === 0) {
    onAddQuestion()
    onAddQuestion()
  }
})
</script>

<template>
  <ASortableListEditor
    v-model="selectedValue.questions"
    v-model:mode="mode"
    v-model:unsaved-keys="unsavedKeys"
    :get-validation-state="getQuestionValidationState"
    title="Questions"
    add-label="Add question"
    allow-edit-in-reorder
    @add="onAddQuestion"
    @deleted="onDeleteQuestion"
  >
    <template #item-compact="{ raw }: { raw: QuizQuestion }">
      <span>{{ raw.title || '(empty question)' }}</span>
    </template>
    <template
      #item="{
        raw,
        actions,
        reorderMode,
      }: {
        raw: QuizQuestion
        actions: { update: (v: QuizQuestion) => void }
        reorderMode: boolean
      }"
    >
      <ACard
        v-if="!reorderMode"
        class="py-5"
      >
        <AFormTextarea
          v-model="raw.title"
          label="Question title"
          required
        />
        <ARow>
          <span class="text-body-small text-medium-emphasis">
            (image widget omitted in playground)
          </span>
        </ARow>
        <VAlert
          v-if="raw.answers.length < 2"
          text="At least 2 answers required."
          type="error"
          density="compact"
          class="mb-2"
        />
        <QuizManageQuestionAnswers
          :model-value="raw"
          :mode="mode"
          :unsaved-keys="
            answerKeys.getForParent(
              (raw.id ?? raw.position) as ListEditorKey,
            )
          "
          :answer-value-type="selectedValue.attributes.answerValueType"
          @update:model-value="actions.update"
          @update:unsaved-keys="
            (s: Set<ListEditorKey>) =>
              answerKeys.setForParent(
                (raw.id ?? raw.position) as ListEditorKey,
                s,
              )
          "
        />
        <AFormTextarea
          v-model="raw.explanation"
          label="Explanation"
          class="mt-4"
        />
        <ARow>
          <span class="text-body-small text-medium-emphasis">
            (explanation image widget omitted in playground)
          </span>
        </ARow>
      </ACard>
      <!-- Reorder mode: only show the embedded answers editor so the user
           can drag answers without the full form chrome. -->
      <div
        v-else
        class="px-2 pb-3"
      >
        <QuizManageQuestionAnswers
          :model-value="raw"
          :mode="mode"
          :unsaved-keys="
            answerKeys.getForParent(
              (raw.id ?? raw.position) as ListEditorKey,
            )
          "
          :answer-value-type="selectedValue.attributes.answerValueType"
          @update:model-value="actions.update"
          @update:unsaved-keys="
            (s: Set<ListEditorKey>) =>
              answerKeys.setForParent(
                (raw.id ?? raw.position) as ListEditorKey,
                s,
              )
          "
        />
      </div>
    </template>
  </ASortableListEditor>
</template>
