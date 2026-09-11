<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import ACard from '@/components/ACard.vue'
import ARow from '@/components/ARow.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import {
  type QuizQuestion,
  type QuizQuestionAnswer,
  type QuizAnswerValueTypeType,
  QuizAnswerValueType,
  createQuizQuestionAnswer,
} from '@/playground/quizManageView/quizMock'

type ReorderMode = 'view' | 'reorder'

const props = defineProps<{
  modelValue: QuizQuestion
  answerValueType: QuizAnswerValueTypeType
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', data: QuizQuestion): void
}>()
const selectedValue = computed({
  get() {
    return props.modelValue
  },
  set(newValue: QuizQuestion) {
    emit('update:modelValue', newValue)
  },
})
const mode = defineModel<ReorderMode>('mode', { default: 'view' })
const valueType = computed(() => props.answerValueType)
watch(valueType, () => {
  selectCorrectAnswer(-1)
})

// true = VALID. An answer needs a non-empty title.
const validateAnswer = (a: QuizQuestionAnswer): boolean => !!a.title && a.title.trim().length > 0

const createAnswer = (): QuizQuestionAnswer => {
  const newAnswer = createQuizQuestionAnswer()
  newAnswer.question = selectedValue.value.id
  newAnswer.position = (selectedValue.value.answers.at(-1)?.position ?? 0) + 1
  return newAnswer
}

const selectCorrectAnswer = (answerIndex: number) => {
  const answers = selectedValue.value.answers
  answers.forEach((answer) => {
    answer.points = 0
  })
  if (answerIndex > -1) {
    answers[answerIndex].points = 1
  }
  selectedValue.value.answers = answers
}

onMounted(() => {
  if (selectedValue.value.answers.length === 0) {
    selectedValue.value.answers.push(createAnswer(), createAnswer())
  }
})
</script>

<template>
  <ASortableListEditor
    v-model="selectedValue.answers"
    v-model:mode="mode"
    :factory="createAnswer"
    :validate="validateAnswer"
    title="Answers"
    add-label="Add answer"
    embedded
  >
    <template #item-compact="{ raw }: { raw: QuizQuestionAnswer }">
      <span>{{ raw.title || '(empty answer)' }}</span>
    </template>
    <template #item="{ raw, index }: { raw: QuizQuestionAnswer; index: number }">
      <ACard class="pt-5">
        <VRow>
          <VCol cols="11">
            <AFormTextarea
              v-model="raw.title"
              label="Answer title"
              required
            />
          </VCol>
          <VCol cols="1">
            <AFormTextField
              v-if="valueType === QuizAnswerValueType.Points"
              v-model.number="raw.points"
              label="Points"
            />
            <VCheckboxBtn
              v-if="valueType === QuizAnswerValueType.Bool"
              v-model.number="raw.points"
              :true-value="1"
              :false-value="0"
              @change="selectCorrectAnswer(index)"
            />
          </VCol>
        </VRow>
        <ARow>
          <span class="text-body-small text-medium-emphasis">
            (image widget omitted in playground)
          </span>
        </ARow>
      </ACard>
    </template>
  </ASortableListEditor>
</template>
