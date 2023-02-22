import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import dts from 'vite-plugin-dts'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/lib.ts'),
      name: 'CommonAdmin',
      fileName: (format) => `common-admin.${format}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'vue',
        /^vuetify(\/.*)?$/,
        'axios',
        'pinia',
        'vue-i18n',
        'vue-router',
        '@vuelidate/core',
        '@vuelidate/validators',
        '@vueuse/core',
        '@vueuse/integrations',
      ],
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
    // nodeResolve(),
    dts({ rollupTypes: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
