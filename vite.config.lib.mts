import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import dts from 'unplugin-dts/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { fileURLToPath, URL } from 'url'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: {
        'common-admin': path.resolve(_dirname, 'src/lib.ts'),
        labs: path.resolve(_dirname, 'src/labs.ts'),
      },
      name: 'CommonAdmin',
      fileName: (format, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      checks: { pluginTimings: false },
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
      include: path.resolve(_dirname, 'src/locales/**/*.json'),
    }),
    dts({
      bundleTypes: true,
      tsconfigPath: 'tsconfig.libdts.json',
      // `VueI18nPlugin` with `runtimeOnly: false` aliases `vue-i18n` to a file inside its dist, and
      // the declaration step followed that alias: the emitted `.d.ts` imported its types from
      // `../../vue-i18n/dist/vue-i18n.esm-bundler.js`, which from a consumer's
      // `node_modules/@anzusystems/common-admin/dist/` resolves to nothing at all. Excluding it here
      // leaves the specifier as the package name, which is what a consumer can resolve. The
      // javascript never had the problem -- `vue-i18n` is external, so the bundle imports it by name.
      aliasesExclude: [/^vue-i18n$/],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
