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
        { text: 'Anchor', link: '/editor/marks/anchor/' },
        { text: 'Bold', link: '/editor/marks/bold/' },
        { text: 'Italic', link: '/editor/marks/italic/' },
        { text: 'Link', link: '/editor/marks/link/' },
        { text: 'Strike', link: '/editor/marks/strike/' },
        { text: 'Subscript', link: '/editor/marks/subscript/' },
        { text: 'Superscript', link: '/editor/marks/superscript/' },
        { text: 'Underline', link: '/editor/marks/underline/' },
      ]
    },
    {
      text: 'Nodes',
      collapsed: false,
      items: [
        { text: 'Blockquote', link: '/editor/nodes/blockquote/' },
        { text: 'BulletList', link: '/editor/nodes/bullet-list/' },
        { text: 'Button', link: '/editor/nodes/button/' },
        { text: 'ContentLock', link: '/editor/nodes/content-lock/' },
        { text: 'Doc', link: '/editor/nodes/doc/' },
        { text: 'EmbedGallery', link: '/editor/nodes/embed-gallery/' },
        { text: 'EmbedImage', link: '/editor/nodes/embed-image/' },
        { text: 'EmbedImageInline', link: '/editor/nodes/embed-image-inline/' },
        { text: 'EmbedRelated', link: '/editor/nodes/embed-related/' },
        { text: 'HardBreak', link: '/editor/nodes/hard-break/' },
        { text: 'Heading', link: '/editor/nodes/heading/' },
        { text: 'HorizontalRule', link: '/editor/nodes/horizontal-rule/' },
        { text: 'ListItem', link: '/editor/nodes/list-item/' },
        { text: 'OrderedList', link: '/editor/nodes/ordered-list/' },
        { text: 'Paragraph', link: '/editor/nodes/paragraph/' },
        { text: 'Table', link: '/editor/nodes/table/' },
        { text: 'TableCell', link: '/editor/nodes/table-cell/' },
        { text: 'TableHeader', link: '/editor/nodes/table-header/' },
        { text: 'TableRow', link: '/editor/nodes/table-row/' },
        { text: 'Text', link: '/editor/nodes/text/' },
      ]
    },
    {
      text: 'Media embeds',
      collapsed: false,
      items: [
        { text: 'General', link: '/editor/media/general/' },
        { text: 'Youtube', link: '/editor/media/youtube/' },
      ]
    },
  ]
}
