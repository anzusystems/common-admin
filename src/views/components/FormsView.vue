<script lang="ts" setup>
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import ARow from '@/components/ARow.vue'
import ATextField from '@/components/form/AFormTextField.vue'
import ATextarea from '@/components/form/AFormTextarea.vue'
import AValueObjectOptionsSelect from '@/components/form/AFormValueObjectOptionsSelect.vue'
import { computed, ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { Grant, useGrant } from '@/model/valueObject/Grant'
import ABooleanToggle from '@/components/form/AFormBooleanToggle.vue'
import ADatetimePicker from '@/components/ADatetimePicker.vue'
import { useValidateRequired } from '@/validators/vuelidate/useValidateRequired'
import { useValidateMinLength } from '@/validators/vuelidate/useValidateMinLength'
import { useValidateMaxLength } from '@/validators/vuelidate/useValidateMaxLength'

const modelData = ref({
  shortText: 'text1',
  longText: 'text2',
  isActive: false,
  grant: Grant.Default,
  publishedAt: null,
})

const required = useValidateRequired()
const minLength = useValidateMinLength()
const maxLength = useValidateMaxLength()

const rules = computed(() => ({
  modelData: {
    shortText: {
      required,
      minLength: minLength(1),
      maxLength: maxLength(100),
    },
    longText: {
      minLength: minLength(1),
      maxLength: maxLength(2000),
    },
    grant: {
      required,
    },
    isActive: {},
  },
}))
const v$ = useVuelidate(rules, { modelData })

const { grantOptions } = useGrant()
</script>

<template>
  <VCard>
    <VCardTitle>Forms</VCardTitle>
    <VCardText>
      <VForm>
        <ASystemEntityScope
          system="system"
          subject="subject"
        >
          <VRow>
            <VCol
              cols="12"
              md="8"
            >
              <ARow>
                <ATextField
                  v-model="modelData.shortText"
                  :v="v$.modelData.shortText"
                />
              </ARow>
              <ARow>
                <ATextarea
                  v-model="modelData.longText"
                  :v="v$.modelData.longText"
                />
              </ARow>
              <ARow>
                <AValueObjectOptionsSelect
                  v-model="modelData.grant"
                  :items="grantOptions"
                  :v="v$.modelData.grant"
                />
              </ARow>
              <ARow>
                <ABooleanToggle
                  v-model="modelData.isActive"
                  required
                />
              </ARow>
              <ARow>
                <ADatetimePicker
                  v-model="modelData.publishedAt"
                  label="Custom label"
                />
              </ARow>
            </VCol>
          </VRow>
        </ASystemEntityScope>
      </VForm>
    </VCardText>
  </VCard>
</template>
