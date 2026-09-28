import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'
import { CSS_LAYER_STATEMENTS, describeAlertHost, describeCssLayerOrder } from '@/testing/appShell'
import { describeCloseButtons } from '@/testing/closeButtons'
import { describeGeneratedRoutes } from '@/testing/generatedRoutes'
import { describeRouteHistory } from '@/testing/routeHistory'
import { describeSortableLists, unregisteredListEditorTags } from '@/testing/sortableLists'
import { globKeyToSrcPath, parseTypedRouterDeclaration } from '@/testing/typedRouter'

// A small admin in the shape vue-router generates: a listing, a record with an edit view, and the
// catch-all. The guard factories run on it as they run in an admin, so every check they register has
// to pass here.

const route = (name: string, path: string) =>
  `    '${name}': RouteRecordInfo<\n      '${name}',\n      '${path}',\n      Record<never, never>,\n      Record<never, never>,\n      | never\n    >,\n`
const page = (file: string, routes: string[]) =>
  `    '${file}': {\n      routes:\n${routes.length ? routes.map((r) => `        | '${r}'\n`).join('') : '        | never\n'}      views:\n        | never\n    }\n`

const declaration =
  `declare module 'vue-router/auto-routes' {\n  export interface RouteNamedMap {\n` +
  route('/', '/') +
  route('/[...pathMatch]', '/:pathMatch(.*)') +
  route('/articles', '/articles') +
  route('/articles/[id]', '/articles/:id(\\\\d+)') +
  route('/articles/[id]/edit', '/articles/:id(\\\\d+)/edit') +
  `  }\n\n  export interface _RouteFileInfoMap {\n` +
  page('src/pages/index.vue', ['/']) +
  page('src/pages/[...pathMatch].vue', ['/[...pathMatch]']) +
  page('src/pages/articles/index.vue', ['/articles']) +
  page('src/pages/articles/[id]/index.vue', ['/articles/[id]']) +
  page('src/pages/articles/[id]/edit.vue', ['/articles/[id]/edit']) +
  page('src/components/NotAPage.vue', []) +
  `  }\n}\n`

const component = defineComponent(() => () => null)
const routes: RouteRecordRaw[] = [
  { path: '/', name: '/', component },
  { path: '/:pathMatch(.*)', name: '/[...pathMatch]', component },
  { path: '/articles', name: '/articles', component },
  { path: '/articles/:id(\\d+)', name: '/articles/[id]', component },
  { path: '/articles/:id(\\d+)/edit', name: '/articles/[id]/edit', component },
]
const pageFiles = [
  '/src/pages/index.vue',
  '/src/pages/[...pathMatch].vue',
  '/src/pages/articles/index.vue',
  '/src/pages/articles/[id]/index.vue',
  '/src/pages/articles/[id]/edit.vue',
]

const sources = {
  '/src/pages/articles/[id]/index.vue': `<template>\n  <ArticleDetailToolbar />\n</template>\n<script setup lang="ts">\nimport ArticleDetailToolbar from '@/components/ArticleDetailToolbar.vue'\n</script>\n`,
  '/src/components/ArticleDetailToolbar.vue': `<template>\n  <AActionCloseButtonHistory\n    :skip-route-names="['/articles/[id]/edit']"\n    :fallback-route-name="'/articles'"\n  />\n</template>\n`,
  '/src/pages/articles/[id]/edit.vue': `<template>\n  <AActionCloseButtonHistory :skip-route-names="['/articles/[id]']" :fallback-route-name="'/articles'" />\n</template>\n`,
}

const routeHistoryBlacklist = ['/[...pathMatch]']

describe('parseTypedRouterDeclaration', () => {
  const parsed = parseTypedRouterDeclaration(declaration)

  it('reads the names in declaration order', () => {
    expect(parsed.names).toEqual(['/', '/[...pathMatch]', '/articles', '/articles/[id]', '/articles/[id]/edit'])
  })

  it('unescapes the constraints the declaration writes as TypeScript source', () => {
    expect(parsed.paths.find(({ name }) => name === '/articles/[id]')?.path).toBe('/articles/:id(\\d+)')
  })

  it('maps a page to its routes and leaves out a file that defines none', () => {
    expect(parsed.pageRoutes.get('src/pages/articles/[id]/edit.vue')).toEqual(['/articles/[id]/edit'])
    expect(parsed.pageRoutes.has('src/components/NotAPage.vue')).toBe(false)
  })
})

describe('globKeyToSrcPath', () => {
  it('maps both glob forms to the path the declaration uses', () => {
    expect(globKeyToSrcPath('../pages/articles/index.vue')).toBe('src/pages/articles/index.vue')
    expect(globKeyToSrcPath('/src/pages/articles/index.vue')).toBe('src/pages/articles/index.vue')
  })
})

describeGeneratedRoutes({ routes, declaration, pageFiles })

describeCloseButtons({ sources, declaration, routeHistoryBlacklist })

describeRouteHistory({
  declaration,
  routeHistoryBlacklist,
  initRouteHistory: () => useRouteHistory().setBlacklistedRoutes([...routeHistoryBlacklist]),
})

// Sixty files, so the guard on the guard sees a real admin; two list editors, one saved by the form
// around it.
const sortableSources = {
  ...Object.fromEntries(
    Array.from({ length: 60 }, (_, i) => [`/src/components/C${i}.vue`, '<template>\n  <div />\n</template>\n'])
  ),
  '/src/pages/articles/[id]/edit.vue': `<template>\n  <ASortableListEditor v-if="items.length > 0" v-model="items" :unsaved-section-label="t('x')" />\n</template>\n`,
  '/src/components/ArticleTags.vue': `<template>\n  <AListEditor v-model="tags" disable-unsaved />\n</template>\n`,
  // The guards' own sources are not the admin's.
  '/src/test/sortable.test.ts': "import { useSortable } from '@vueuse/integrations/useSortable'\n",
}

describeSortableLists({ sources: sortableSources })

describe('unregisteredListEditorTags', () => {
  it('finds an editor after an apostrophe in a comment', () => {
    // Paired across the file, the apostrophe pairs with the import's quote, and the next quote pairs with
    // the one inside the mustache, swallowing the tag in between.
    const source =
      `<script setup lang="ts">\n// the editor's rows\nimport { ref } from 'vue'\n</script>\n` +
      `<template>\n  <AListEditor v-model="rows" />\n  {{ t('rows') }}\n</template>\n`
    expect(unregisteredListEditorTags(source)).toEqual(['<AListEditor v-model="rows" />'])
  })

  it('reads past a > inside an attribute value', () => {
    const source = `<ASortableListEditor v-if="items.length > 0" v-model="items" :unsaved-section-label="t('x')" />`
    expect(unregisteredListEditorTags(source)).toEqual([])
  })

  it('takes only the bare attributes as an opt-out', () => {
    expect(unregisteredListEditorTags('<AListEditor v-model="a" readonly />')).toEqual([])
    expect(unregisteredListEditorTags('<AListEditor v-model="a" disable-unsaved />')).toEqual([])
    expect(unregisteredListEditorTags('<AListEditor v-model="a" :readonly="readonly" />')).toHaveLength(1)
    expect(unregisteredListEditorTags(`<AListEditor v-model="a" :title="'readonly'" />`)).toHaveLength(1)
  })

  it('leaves out an editor handed the controller of the list it is nested in', () => {
    expect(unregisteredListEditorTags('<AListEditor v-model="answers" embedded :editor="editor" />')).toEqual([])
  })

  it('checks each editor in a file on its own', () => {
    const source =
      `<ANestedSortableListEditor v-model="tree" :unsaved-section-label="t('tree')" />\n` +
      `<ASortableListEditor v-model="items" />\n`
    expect(unregisteredListEditorTags(source)).toEqual(['<ASortableListEditor v-model="items" />'])
  })
})

describeAlertHost({
  sources: {
    '/src/layouts/AppLayout.vue': `<template>\n  <AAlerts />\n  <component :is="layout" />\n</template>\n`,
    '/src/layouts/BlankLayout.vue': '<template>\n  <RouterView />\n</template>\n',
    '/src/layouts/DefaultLayout.vue': '<template>\n  <RouterView />\n</template>\n',
    '/src/layouts/LoaderLayout.vue': '<template>\n  <RouterView />\n</template>\n',
  },
})

describeAlertHost({
  sources: {
    '/src/layouts/AppLayout.vue': `<template>\n  <ALayoutSwitch :layouts="layouts">\n    <slot />\n  </ALayoutSwitch>\n</template>\n`,
    '/src/layouts/AppLayoutDrawer.vue': '<template>\n  <RouterView />\n</template>\n',
    '/src/layouts/AppLayoutFullscreen.vue': '<template>\n  <RouterView />\n</template>\n',
    '/src/layouts/AppLayoutMain.vue': '<template>\n  <RouterView />\n</template>\n',
  },
})

describeCssLayerOrder({ indexHtml: `<style>\n  ${CSS_LAYER_STATEMENTS.join('\n  ')}\n</style>\n` })

// cms's shape: links that are not stylesheets and a commented-out style before it, fonts after it.
describeCssLayerOrder({
  indexHtml:
    '<link rel="icon" href="/favicon.ico">\n<link rel="preload" as="font" href="/a.woff2">\n<!-- <style>.old {}</style> -->\n' +
    `<head>\n<style>\n  /* order */\n  ${CSS_LAYER_STATEMENTS.join(' ')}\n\n  @font-face { font-family: a; }\n</style>\n</head>\n<body><link rel="stylesheet" href="/late.css"></body>\n`,
})
