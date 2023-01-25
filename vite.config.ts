import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import dts from 'vite-plugin-dts'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib.ts'),
      name: 'CommonAdmin',
      fileName: (format) => `common-admin.${format}.js`,
    },
    rollupOptions: {
      external: ['vue', 'vuetify'],
      output: {
        globals: {
          vue: 'Vue',
          vuetify: 'Vuetify',
        },
      },
    },
  },
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    VueI18nPlugin({
      globalSFCScope: true,
      runtimeOnly: false,
      include: path.resolve(__dirname, 'src/locales/**'),
    }),
    dts({ insertTypesEntry: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
