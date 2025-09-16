/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'url'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import path, { dirname } from 'path'

const _dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
    }),
    VueI18nPlugin({
      globalSFCScope: true,
      include: path.resolve(_dirname, './src/locales/**.json'),
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: 'localhost',
    watch: {
      usePolling: true,
    },
  },
  optimizeDeps: {
    include: [
      'vue-router',
      'vuetify/components/VApp',
      'vuetify/components/VAppBar',
      'vuetify/components/VDivider',
      'vuetify/components/VGrid',
      'vuetify/components/VMain',
      'vuetify/components/VNavigationDrawer',
      'vuetify/locale/adapters/vue-i18n',
      'webfontloader',
      'vuetify/components/VCard',
      'vuetify/components/VAlert',
      'vuetify/components/VIcon',
      'socket.io-client',
      'vuetify/components/VTextField',
      'vuetify/components/VBtn',
      'vuetify/components/VSwitch',
      '@vuelidate/core',
      'vuetify/components/VDialog',
      'vuetify/components/VList',
      'vuetify/components/VForm',
      '@sentry/vue',
      'vuetify/components/VBreadcrumbs',
      'vuetify/components/VCheckbox',
      'vuetify/components/VDataTable',
      '@vueuse/integrations/useSortable',
      'vuetify/components/VChip',
      'vuetify/components/VMenu',
      'vuetify/components/VTooltip',
      'vuetify/components/VToolbar',
      'vuetify/components/VBtnToggle',
      'vuetify/components/VImg',
      'vuetify/components/VProgressCircular',
      'dayjs',
      'dayjs/plugin/utc',
      'dayjs/plugin/customParseFormat',
      'vuetify/components/VAvatar',
      'vuetify/components/VDatePicker',
      'vuetify/components/transitions',
      'vuetify/components/VTextarea',
      'vuetify/components/VAutocomplete',
      '@vuelidate/validators',
      'vuetify/components/VExpansionPanel',
      'vuetify/components/VSelect',
      'vuetify/components/VTable',
      'uuid',
      'dayjs/plugin/duration',
      'rusha',
      'vuetify/components/VTabs',
      'cropperjs',
      'vuetify/components/VCombobox',
      'vuetify/components/VColorPicker',
      'vuetify/components/VSlider',
      'vuetify/components/VLabel',
    ],
  },
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    retry: process.env.CI ? 2 : 1,
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [
        {
          browser: 'chromium',
          headless: process.env.CI ? true : false, // Headless in CI, visible locally
        },
      ],
      isolate: true,
    },
  },
})
