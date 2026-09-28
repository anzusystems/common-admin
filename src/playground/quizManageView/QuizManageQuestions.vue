<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ACard from '@/components/ACard.vue'
import ARow from '@/components/ARow.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import QuizManageQuestionAnswers from '@/playground/quizManageView/QuizManageQuestionAnswers.vue'
import {
  type Quiz,
  type QuizQuestion,
  createQuizQuestion,
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

// true = VALID. A question needs a title, at least 2 answers, and every
// answer titled. (Field-level vuelidate messages stay inside the row form.)
const validateQuestion = (q: QuizQuestion): boolean =>
  !!q.title && q.answers.length >= 2 && q.answers.every((a) => !!a.title)

const createQuestion = (): QuizQuestion => {
  const newQuestion = createQuizQuestion()
  newQuestion.quiz = selectedValue.value.id
  newQuestion.position = (selectedValue.value.questions.at(-1)?.position ?? 0) + 1
  return newQuestion
}

onMounted(() => {
  if (selectedValue.value.questions.length === 0) {
    selectedValue.value.questions.push(createQuestion(), createQuestion())
  }
})
</script>

<template>
  <ASortableListEditor
    v-model="selectedValue.questions"
    v-model:mode="mode"
    :factory="createQuestion"
    :validate="validateQuestion"
    title="Questions"
    add-label="Add question"
    allow-edit-in-reorder
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
          :answer-value-type="selectedValue.attributes.answerValueType"
          @update:model-value="actions.update"
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
          :answer-value-type="selectedValue.attributes.answerValueType"
          @update:model-value="actions.update"
        />
      </div>
    </template>
  </ASortableListEditor>
</template>
