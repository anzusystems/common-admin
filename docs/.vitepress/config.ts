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
    ['link', { rel: "icon", href: "/common-admin/favicon.ico?v=2"}],
    ['link', { rel: "apple-touch-icon", sizes: "180x180", href: "/common-admin/apple-touch-icon.png?v=2"}],
    ['link', { rel: "icon", type: "image/png", sizes: "32x32", href: "/common-admin/favicon-32x32.png?v=2"}],
    ['link', { rel: "icon", type: "image/png", sizes: "16x16", href: "/common-admin/favicon-16x16.png?v=2"}],
    ['link', { rel: "manifest", crossorigin: "use-credentials", href: "/common-admin/site.webmanifest?v=2"}],
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

    sidebar: {
      '/guide/': sidebarGuide(),
      '/styleguide/': sidebarGuide(),
      '/editor/': sidebarEditor(),
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
      text: 'Editor',
      link: '/editor/introduction/',
      activeMatch: '/editor/'
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

function sidebarEditor() {
  return [
    {
      text: 'General',
      collapsed: false,
      items: [
        { text: 'Introduction', link: '/editor/introduction/' },
        { text: 'Editor', link: '/editor/editor/' },
      ]
    },
    {
      text: 'Marks',
      collapsed: false,
      items: [
        { text: 'bold', link: '/editor/marks/bold/' },
        { text: 'italic', link: '/editor/marks/italic/' },
        { text: 'link', link: '/editor/marks/link/' },
        { text: 'strike', link: '/editor/marks/strike/' },
        { text: 'subscript', link: '/editor/marks/subscript/' },
        { text: 'superscript', link: '/editor/marks/superscript/' },
        { text: 'underline', link: '/editor/marks/underline/' },
      ]
    },
    {
      text: 'Nodes',
      collapsed: false,
      items: [
        { text: 'anchor', link: '/editor/nodes/anchor/' },
        { text: 'blockquote', link: '/editor/nodes/blockquote/' },
        { text: 'bulletList', link: '/editor/nodes/bullet-list/' },
        { text: 'button', link: '/editor/nodes/button/' },
        { text: 'contentBreak', link: '/editor/nodes/content-break/' },
        { text: 'contentLock', link: '/editor/nodes/content-lock/' },
        { text: 'doc', link: '/editor/nodes/doc/' },
        { text: 'embedCustom', link: '/editor/nodes/embed-custom/' },
        { text: 'embedGallery', link: '/editor/nodes/embed-gallery/' },
        { text: 'embedImage', link: '/editor/nodes/embed-image/' },
        { text: 'embedImageInline', link: '/editor/nodes/embed-image-inline/' },
        { text: 'embedInfobox', link: '/editor/nodes/embed-infobox/' },
        { text: 'embedMedia', link: '/editor/nodes/embed-media/' },
        { text: 'embedMinute', link: '/editor/nodes/embed-minute/' },
        { text: 'embedPoll', link: '/editor/nodes/embed-poll/' },
        { text: 'embedQuiz', link: '/editor/nodes/embed-quiz/' },
        { text: 'embedRelated', link: '/editor/nodes/embed-related/' },
        { text: 'embedWeather', link: '/editor/nodes/embed-weather/' },
        { text: 'hardBreak', link: '/editor/nodes/hard-break/' },
        { text: 'heading', link: '/editor/nodes/heading/' },
        { text: 'horizontalRule', link: '/editor/nodes/horizontal-rule/' },
        { text: 'listItem', link: '/editor/nodes/list-item/' },
        { text: 'orderedList', link: '/editor/nodes/ordered-list/' },
        { text: 'paragraph', link: '/editor/nodes/paragraph/' },
        { text: 'review', link: '/editor/nodes/review/' },
        { text: 'styledBox', link: '/editor/nodes/styled-box/' },
        { text: 'table', link: '/editor/nodes/table/' },
        { text: 'tableCell', link: '/editor/nodes/table-cell/' },
        { text: 'tableHeader', link: '/editor/nodes/table-header/' },
        { text: 'tableRow', link: '/editor/nodes/table-row/' },
        { text: 'text', link: '/editor/nodes/text/' },
      ]
    },
    {
      text: 'Media embeds',
      collapsed: false,
      items: [
        { text: 'General', link: '/editor/media/general/' },
        { text: 'youtube', link: '/editor/media/youtube/' },
      ]
    },
  ]
}
