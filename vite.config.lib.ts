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
      entry: {
        'common-admin': path.resolve(__dirname, 'src/lib.ts'),
        'labs': path.resolve(__dirname, 'src/labs.ts')
      },
      name: 'CommonAdmin',
      fileName: (format, entryName) => `${entryName}.${format}.js`,
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
        'socket.io-client',
      ],
    },
  },
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    VueI18nPlugin({
      globalSFCScope: true,
      runtimeOnly: false,
      include: path.resolve(__dirname, 'src/locales/**.json'),
    }),
    dts({ rollupTypes: true, tsconfigPath: 'tsconfig.libdts.json' }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
