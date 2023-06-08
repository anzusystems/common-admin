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
  base: '/common-admin/',
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
  head: [
    ['link', { rel: "icon", href: "/favicon.ico?v=1"}],
    ['link', { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=1"}],
    ['link', { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png?v=1"}],
    ['link', { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png?v=1"}],
    ['link', { rel: "manifest", crossorigin: "use-credentials", href: "/site.webmanifest?v=1"}],
    ['link', { rel: "mask-icon", href: "/safari-pinned-tab.svg", color: "#5bbad5"}],
    ['meta', { name: "msapplication-TileColor", content: "#da532c"}],
    ['meta', { name: "theme-color", content: "#ffffff"}],
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    search: {
      provider: 'local'
    },
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
    { text: 'Guide', link: '/guide/introduction/', activeMatch: '/guide/' },
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
      text: 'Guide',
      collapsed: false,
      items: [
        { text: 'Introduction', link: '/guide/introduction/' },
        { text: 'Installation', link: '/guide/installation/' },
        { text: 'Localization', link: '/guide/i18n/' },
        { text: 'Local development', link: '/guide/local-development/' },
      ]
    },
    {
      text: 'Styleguide',
      collapsed: false,
      items: [
        { text: 'Basic info', link: '/styleguide/basic/' },
        { text: 'Layouts', link: '/styleguide/layouts/' },
        { text: 'Views', link: '/styleguide/views/' },
        { text: 'Dialogs', link: '/styleguide/dialogs/' },
        { text: 'Forms', link: '/styleguide/forms/' },
        { text: 'Buttons', link: '/styleguide/buttons/' },
        { text: 'Chips', link: '/styleguide/chips/' },
        { text: 'Other', link: '/styleguide/other/' },
      ]
    },
  ]
}
