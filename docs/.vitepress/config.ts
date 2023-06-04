import { createRequire } from 'module'
import { defineConfig } from 'vitepress'
import { fileURLToPath, URL } from 'url'
import vuetify from 'vite-plugin-vuetify'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import path, { dirname } from 'path'
// @ts-ignore
import { getApiSidebarItems } from './apiSidebar'

const _dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

// https://vitepress.dev/reference/site-config
export default defineConfig({
  vite: {
    ssr: {
      noExternal: [/.*/]
    },
    plugins: [
      vuetify({
        autoImport: true,
      }),
      VueI18nPlugin({
        globalSFCScope: true,
        include: path.resolve(_dirname, '../../src/locales/**.json'),
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('../../src', import.meta.url)),
      },
    }
  },
  lang: 'en-US',
  lastUpdated: true,
  title: "CommonAdmin",
  description: "Components for anzusystems vue projects",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: nav(),
    // nav: [
    //   { text: 'Home', link: '/' },
    //   { text: 'Examples', link: '/markdown-examples' }
    // ],

    sidebar: {
      '/guide/': sidebarGuide(),
      '/styleguide/': sidebarGuide(),
      '/api/': getApiSidebarItems()
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/anzusystems/common-admin' }
    ],

    footer: {
      message: 'Released under the Apache License 2.0.'
    },
  }
})

function nav() {
  return [
    { text: 'Guide', link: '/guide/what-is-common-admin', activeMatch: '/guide/' },
    {
      text: 'API',
      link: '/api/',
      activeMatch: '/api/'
    },
    {
      text: pkg.version,
      items: [
        {
          text: 'Changelog',
          link: 'https://github.com/anzusystems/common-admin/blob/main/CHANGELOG.md'
        }
      ]
    }
  ]
}

function sidebarGuide() {
  return [
    {
      text: 'Introduction',
      collapsed: false,
      items: [
        { text: 'What is CommonAdmin?', link: '/guide/what-is-common-admin' },
        { text: 'Usage in project', link: '/guide/usage-in-project' },
        { text: 'Local development', link: '/guide/local-development' },
        { text: 'i18n', link: '/guide/i18n' },
      ]
    },
    {
      text: 'Styleguide',
      collapsed: false,
      items: [
        { text: 'Basic info', link: '/styleguide/basic' },
        { text: 'Layout', link: '/styleguide/layout' },
        { text: 'Views', link: '/styleguide/views' },
        { text: 'Dialog', link: '/styleguide/dialog' },
        { text: 'Form', link: '/styleguide/form' },
        { text: 'Buttons', link: '/styleguide/buttons' },
        { text: 'Chip', link: '/styleguide/chip' },
        { text: 'Other', link: '/styleguide/other' },
      ]
    },
  ]
}
