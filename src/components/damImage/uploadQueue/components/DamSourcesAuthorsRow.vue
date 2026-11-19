<script
  lang="ts"
  setup
>
import { useI18n } from 'vue-i18n'
import ARow from '@/components/ARow.vue'

withDefaults(
  defineProps<{
    sourceEnabled: boolean
    authorEnabled?: boolean
    credit?: string
    creditLabel?: string
  }>(),
  {
    authorEnabled: true,
    credit: '',
    creditLabel: undefined,
  },
)

const { t } = useI18n()
</script>

<template>
  <div
    v-if="sourceEnabled || authorEnabled"
    class="a-dam-sources-authors"
  >
    <div class="a-dam-sources-authors__fields">
      <div
        v-if="sourceEnabled"
        class="a-dam-sources-authors__sources"
      >
        <slot name="sources" />
      </div>
      <VIcon
        v-if="sourceEnabled && authorEnabled"
        icon="mdi-slash-forward"
        class="a-dam-sources-authors__slash"
      />
      <div
        v-if="authorEnabled"
        class="a-dam-sources-authors__authors"
      >
        <slot name="authors" />
      </div>
    </div>
    <ARow
      v-if="sourceEnabled && credit.length > 0"
      :title="creditLabel ?? t('common.damImage.image.model.texts.source')"
      :value="credit"
      class="pb-5"
      data-cy="credit-preview"
    />
  </div>
</template>

<style lang="scss" scoped>
// Side by side with the slash mirrors the credit "{sources}/{authors}". Below 560 px a field gets too
// narrow for a typical author chip (~220 px at the 90th percentile), so the fields stack without the
// slash; the rendered credit below shows the same shape. Sources are short agency names, hence 2:3.
.a-dam-sources-authors {
  container-type: inline-size;
}

.a-dam-sources-authors__fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.a-dam-sources-authors__sources,
.a-dam-sources-authors__authors {
  min-width: 0;
}

.a-dam-sources-authors__slash {
  display: none;
}

@container (min-width: 560px) {
  .a-dam-sources-authors__fields {
    flex-direction: row;
    align-items: flex-start;
  }

  .a-dam-sources-authors__sources {
    flex: 2 1 0;
  }

  .a-dam-sources-authors__authors {
    flex: 3 1 0;
  }

  .a-dam-sources-authors__slash {
    display: inline-flex;
    margin-top: 5px;
  }
}
</style>
