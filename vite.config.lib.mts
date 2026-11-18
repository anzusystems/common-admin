import fs from 'node:fs'
import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import dts from 'unplugin-dts/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { fileURLToPath, URL } from 'url'
import { devCopyToAdmins } from './scripts/vite/devCopyToAdmins.mts'

const _dirname = path.dirname(fileURLToPath(import.meta.url))
// `COMMON_ADMIN_DTS=0`: JavaScript and CSS only (`yarn dev:admin`); the declarations take most of the build.
const withDeclarations = process.env.COMMON_ADMIN_DTS !== '0'

// With one file per module, @intlify/unplugin-vue-i18n names locale files
// `virtual:intlify-i18n-N` in first-resolve order, and N appears in file names and imports.
// That order depends on build parallelism, so builds of one commit differed.
// Resolving all locale files up front, sorted, makes it deterministic.
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

// `./styles` resolves to a bare .css file; its `types` condition points at this declaration.
const stylesDeclaration = (): Plugin => ({
  name: 'anzu:styles-declaration',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'common-admin.css.d.ts',
      source: fs.readFileSync(path.join(_dirname, 'types/common-admin.css.d.ts'), 'utf8'),
    })
  },
})

// Every library stylesheet, SFC blocks included, goes into one cascade layer.
// Unlayered, the library beat every Vuetify and admin rule regardless of specificity.
// An admin places the layer in its `@layer` statement (index.html). `ANZU_CSS_LAYER=` (empty) builds unlayered CSS.
const cssLayer = process.env.ANZU_CSS_LAYER ?? 'anzu-common'
const layerStylesheet = (layer: string) => ({
  postcssPlugin: 'anzu:css-layer',
  OnceExit(root: import('postcss').Root, { AtRule }: import('postcss').Helpers) {
    // @import and @charset must stay first and outside a layer block; a block that names its own layer
    // (the reset in `vuetify-core.reset`) keeps it
    const body = root.nodes.filter(
      (node) => !(node.type === 'atrule' && ['import', 'charset', 'layer'].includes(node.name))
    )
    if (!body.some((node) => node.type !== 'comment')) return
    const block = new AtRule({ name: 'layer', params: layer })
    block.append(body)
    root.append(block)
  },
})

// The layer order the library expects. An admin declares it in index.html before
// any stylesheet; here it only applies when this stylesheet names the layers first.
// Vuetify's sub-layers follow its main.css order, which its component stylesheets would
// otherwise decide by loading first (`src/testing/appShell.ts`, CSS_SUBLAYER_ORDER).
export const CSS_LAYER_ORDER =
  '@layer vuetify-core, vuetify-components, vuetify-overrides, anzu-common, vuetify-utilities, vuetify-final;' +
  '@layer vuetify-core.reset, vuetify-core.base;' +
  '@layer vuetify-utilities.theme-base, vuetify-utilities.typography, vuetify-utilities.helpers, vuetify-utilities.theme-background, vuetify-utilities.theme-foreground;' +
  '@layer vuetify-final.transitions, vuetify-final.trumps;'
const layerOrder = (): Plugin => ({
  name: 'anzu:css-layer-order',
  enforce: 'post',
  generateBundle: {
    order: 'post',
    handler(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (cssLayer && file.type === 'asset' && file.fileName.endsWith('.css'))
          file.source = CSS_LAYER_ORDER + file.source
      }
    },
  },
})

export default defineConfig({
  css: {
    postcss: { plugins: cssLayer ? [layerStylesheet(cssLayer)] : [] },
  },
  build: {
    // `public/` holds the playground's favicons and cropper images, none of which a consumer needs.
    copyPublicDir: false,
    sourcemap: true,
    lib: {
      entry: {
        'common-admin': path.resolve(_dirname, 'src/lib.ts'),
        // `./testing`, the admins' guard tests. Its own entry, so the main one never pulls in vitest.
        testing: path.resolve(_dirname, 'src/testing/index.ts'),
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
        'vitest',
      ],
      output: {
        // One file per module, so a consumer's bundler, with `sideEffects`, takes only what it imports.
        // Not in `yarn dev:admin` (`COMMON_ADMIN_DEV_BUNDLE=1`): the dev server serves the library unbundled,
        // and ~800 extra modules made every third reload fail in Chrome with ERR_INSUFFICIENT_RESOURCES.
        preserveModules: process.env.COMMON_ADMIN_DEV_BUNDLE !== '1',
        preserveModulesRoot: 'src',
        // Bundled dependencies go to `dist/vendor/` because `yarn
        // pack` omits every `node_modules` directory, nested ones too.
        // Library modules keep `[name]`, which rolldown sanitizes (a Vue block id carries `?vue&type=…`).
        entryFileNames: (chunk) =>
          /[\\/]node_modules[\\/]/.test(chunk.facadeModuleId ?? '')
            ? `${chunk.name.replace(/^(.*\/)?node_modules\//, 'vendor/')}.js`
            : '[name].js',
      },
    },
  },
  plugins: [
    deterministicLocaleIds(),
    layerOrder(),
    stylesDeclaration(),
    vue(),
    vuetify({ autoImport: true }),
    VueI18nPlugin({
      globalSFCScope: true,
      runtimeOnly: false,
      include: path.resolve(_dirname, 'src/locales/**/*.json'),
    }),
    withDeclarations &&
      dts({
        // One declaration file per module, next to its JavaScript. The rolled-up file lost vue-tsc's
        // `__VLS_*` types (slot props became `any`) and made go-to-definition land in one 13 000-line file.
        // The entry `dist/common-admin.d.ts` re-exports `./lib`.
        insertTypesEntry: true,
        tsconfigPath: 'tsconfig.libdts.json',
        // `VueI18nPlugin` with `runtimeOnly: false` aliases `vue-i18n` to a file in its dist. Without this, the
        // emitted `.d.ts` imported types from a relative path that does not resolve in a consumer's node_modules.
        // Excluding it keeps the package name as the specifier. The JavaScript is fine because `vue-i18n` is external.
        aliasesExclude: [/^vue-i18n$/],
      }),
    devCopyToAdmins(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
