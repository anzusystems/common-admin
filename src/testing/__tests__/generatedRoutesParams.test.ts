import { defineComponent } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { describeGeneratedRoutes } from '@/testing/generatedRoutes'

// The smoke test fills a param its route constrains with a value the constraint takes. It used to
// know `\d+` only and fill everything else with `sample`, so a route constrained to a uuid or a log's
// ObjectId "fell through to the catch-all" in every admin that has one -- the route was fine, the
// filler was not. Each shape here fails against that filler.

const route = (name: string, path: string) =>
  `    '${name}': RouteRecordInfo<\n      '${name}',\n      '${path}',\n      Record<never, never>,\n      Record<never, never>,\n      | never\n    >,\n`
const page = (file: string, routes: string[]) =>
  `    '${file}': {\n      routes:\n${routes.map((r) => `        | '${r}'\n`).join('')}      views:\n        | never\n    }\n`

const UUID = '[0-9a-f-]{36}'
const OBJECT_ID = '[0-9a-f]{24}'

const declaration =
  `declare module 'vue-router/auto-routes' {\n  export interface RouteNamedMap {\n` +
  route('/[...pathMatch]', '/:pathMatch(.*)') +
  route('/authors/[id]', `/authors/:id(${UUID})`) +
  route('/podcasts/[id]/episodes/[episodeId]', `/podcasts/:id(${UUID})/episodes/:episodeId(${UUID})`) +
  route('/logs/[type]/[id]', `/logs/:type/:id(${OBJECT_ID})`) +
  route('/jobs/[id]', '/jobs/:id(\\\\d+)') +
  route('/tags/[slug]', '/tags/:slug') +
  route('/nested/[id]', '/nested/:id((?:\\\\d+\\\\))') +
  `  }\n\n  export interface _RouteFileInfoMap {\n` +
  page('src/pages/[...pathMatch].vue', ['/[...pathMatch]']) +
  page('src/pages/authors/[id].vue', ['/authors/[id]']) +
  page('src/pages/podcasts/[id]/episodes/[episodeId].vue', ['/podcasts/[id]/episodes/[episodeId]']) +
  page('src/pages/logs/[type]/[id].vue', ['/logs/[type]/[id]']) +
  page('src/pages/jobs/[id].vue', ['/jobs/[id]']) +
  page('src/pages/tags/[slug].vue', ['/tags/[slug]']) +
  page('src/pages/nested/[id].vue', ['/nested/[id]']) +
  `  }\n}\n`

const component = defineComponent(() => () => null)
const routes: RouteRecordRaw[] = [
  { path: '/:pathMatch(.*)', name: '/[...pathMatch]', component },
  { path: `/authors/:id(${UUID})`, name: '/authors/[id]', component },
  {
    path: `/podcasts/:id(${UUID})/episodes/:episodeId(${UUID})`,
    name: '/podcasts/[id]/episodes/[episodeId]',
    component,
  },
  { path: `/logs/:type/:id(${OBJECT_ID})`, name: '/logs/[type]/[id]', component },
  { path: '/jobs/:id(\\d+)', name: '/jobs/[id]', component },
  { path: '/tags/:slug', name: '/tags/[slug]', component },
  // A group inside the param's regex closes with `\\)`, as vue-router wants it.
  { path: '/nested/:id((?:\\d+\\))', name: '/nested/[id]', component },
]
const pageFiles = [
  '/src/pages/[...pathMatch].vue',
  '/src/pages/authors/[id].vue',
  '/src/pages/podcasts/[id]/episodes/[episodeId].vue',
  '/src/pages/logs/[type]/[id].vue',
  '/src/pages/jobs/[id].vue',
  '/src/pages/tags/[slug].vue',
  '/src/pages/nested/[id].vue',
]

describeGeneratedRoutes({ routes, declaration, pageFiles })
