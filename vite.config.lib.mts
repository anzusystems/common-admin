import fs from 'node:fs'
import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import dts from 'unplugin-dts/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { fileURLToPath, URL } from 'url'

const _dirname = path.dirname(fileURLToPath(import.meta.url))

// With one output file per module, @intlify/unplugin-vue-i18n names each locale file
// `virtual:intlify-i18n-N` in the order it first resolves them, and N ends up in file names and
// imports. That order follows the build's parallelism, so two builds of one commit differed.
// Resolving every locale file up front, sorted, fixes it.
const deterministicLocaleIds = (): Plugin => ({
  name: 'anzu:deterministic-locale-ids',
  enforce: 'pre',
  async buildStart() {
    const dir = path.join(_dirname, 'src/locales')
    const files = fs
      .readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.json'))
      .map((file) => path.join(dir, file))
      .sort()
    for (const file of files) await this.resolve(file, path.join(_dirname, 'src/lib.ts'))
  },
})

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: {
        'common-admin': path.resolve(_dirname, 'src/lib.ts'),
      },
      name: 'CommonAdmin',
      fileName: (format, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    rolldownOptions: {
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
        // subpath imports (`@vueuse/integrations/useSortable`, `dayjs/plugin/utc`) do not match a plain name
        /^@vueuse\/(core|integrations)(\/.*)?$/,
        /^dayjs(\/.*)?$/,
        /^sortablejs$/,
        'socket.io-client',
        '@sentry/vue',
      ],
      output: {
        // One file per module: a consumer's bundler takes what it imports and leaves the rest,
        // together with `sideEffects` in package.json.
        preserveModules: true,
        preserveModulesRoot: 'src',
        // Bundled dependencies go to `dist/vendor/`: `yarn pack` leaves out every `node_modules`
        // directory, a nested one too. Only their names are built by hand; the library's own modules
        // keep `[name]`, which rolldown sanitizes (a Vue block's id carries `?vue&type=…`).
        entryFileNames: (chunk) =>
          /[\\/]node_modules[\\/]/.test(chunk.facadeModuleId ?? '')
            ? `${chunk.name.replace(/^(.*\/)?node_modules\//, 'vendor/')}.js`
            : '[name].js',
      },
    },
  },
  plugins: [
    deterministicLocaleIds(),
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
