<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useFetch } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    configUrl?: string
  }>(),
  {
    configUrl: '',
  }
)

const { t } = useI18n()

interface AdminConfigItem {
  id: string
  title: string
  url: string
  icon: string
}

const config = ref<AdminConfigItem[]>([])

onMounted(async () => {
  if (props.configUrl.length > 0) {
    try {
      const { data } = await useFetch<AdminConfigItem[]>(props.configUrl).get().json()
      config.value = data.value
    } catch (e) {
      //
    }
  }
})
</script>

<template>
  <VBtn
    v-if="config.length > 0"
    variant="text"
    size="small"
    icon
  >
    <VIcon icon="mdi-dots-grid" />
    <VTooltip
      activator="parent"
      location="top"
    >
      {{ t('common.system.adminSwitcher.button') }}
    </VTooltip>
    <VMenu activator="parent">
      <VCard>
        <div class="a-admin-switcher__content">
          <a
            v-for="item in config"
            :key="item.id"
            :href="item.url"
            rel="noopener noreferrer"
            target="_blank"
            class="a-admin-switcher__item"
          >
            <img
              :src="item.icon"
              :alt="item.title"
            >
            <span class="a-admin-switcher__item-title">{{ item.title }}</span>
          </a>
        </div>
      </VCard>
    </VMenu>
  </VBtn>
</template>

<style lang="scss">
.a-admin-switcher {
  &__content {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: auto;
    padding: 6px;
  }

  &__item {
    display: flex;
    width: 96px;
    height: 96px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-decoration: none;
    color: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));

    &:hover {
      background-color: currentColor;
      border-radius: 8px;
    }

    &-title {
      display: flex;
      font-weight: normal;
      font-size: 14px;
      line-height: 14px;
      color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
      padding: 8px 0;
    }

    img {
      display: block;
      width: auto;
      height: 50px;
    }
  }
}
</style>
