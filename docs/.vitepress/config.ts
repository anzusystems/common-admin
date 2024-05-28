import { DefaultTheme, defineConfig } from 'vitepress'
import { fileURLToPath, URL } from 'url'
import vuetify from 'vite-plugin-vuetify'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import path, { dirname } from 'path'
// @ts-ignore
import { getApiSidebarItems } from './apiSidebar'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import pkg from '../../package.json'

const _dirname = dirname(fileURLToPath(import.meta.url))

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
  markdown: {
    codeTransformers: [
      transformerTwoslash()
    ]
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

function nav(): DefaultTheme.NavItem[] {
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
        { text: 'Anzutap', link: '/editor/anzutap/' },
      ]
    },
    {
      text: 'Nodes',
      collapsed: false,
      items: [
        { text: 'Nodes', link: '/editor/nodes/general/' },
        { text: 'doc', link: '/editor/nodes/doc/' },
        { text: 'bulletList', link: '/editor/nodes/bullet-list/' },
        { text: 'button', link: '/editor/nodes/button/' },
        { text: 'contentBreak', link: '/editor/nodes/content-break/' },
        { text: 'contentLock', link: '/editor/nodes/content-lock/' },
        { text: 'embedAudio', link: '/editor/nodes/embed-audio/' },
        { text: 'embedCrossBox', link: '/editor/nodes/embed-cross-box/' },
        { text: 'embedCustom', link: '/editor/nodes/embed-custom/' },
        { text: 'embedExternal', link: '/editor/nodes/embed-external/' },
        { text: 'embedExternalImage', link: '/editor/nodes/embed-external-image/' },
        { text: 'embedExternalImageInline', link: '/editor/nodes/embed-external-image-inline/' },
        { text: 'embedFaq', link: '/editor/nodes/embed-faq/' },
        { text: 'embedGallery', link: '/editor/nodes/embed-gallery/' },
        { text: 'embedImage', link: '/editor/nodes/embed-image/' },
        { text: 'embedImageInline', link: '/editor/nodes/embed-image-inline/' },
        { text: 'embedMinute', link: '/editor/nodes/embed-minute/' },
        { text: 'embedPoll', link: '/editor/nodes/embed-poll/' },
        { text: 'embedQuiz', link: '/editor/nodes/embed-quiz/' },
        { text: 'embedRelated', link: '/editor/nodes/embed-related/' },
        { text: 'embedReview', link: '/editor/nodes/embed-review/' },
        { text: 'embedTimeline', link: '/editor/nodes/embed-timeline/' },
        { text: 'embedVideo', link: '/editor/nodes/embed-video/' },
        { text: 'embedWeather', link: '/editor/nodes/embed-weather/' },
        { text: 'hardBreak', link: '/editor/nodes/hard-break/' },
        { text: 'heading', link: '/editor/nodes/heading/' },
        { text: 'horizontalRule', link: '/editor/nodes/horizontal-rule/' },
        { text: 'listItem', link: '/editor/nodes/list-item/' },
        { text: 'orderedList', link: '/editor/nodes/ordered-list/' },
        { text: 'paragraph', link: '/editor/nodes/paragraph/' },
        { text: 'quote', link: '/editor/nodes/quote/' },
        { text: 'quoteContent', link: '/editor/nodes/quote-content/' },
        { text: 'quoteAuthor', link: '/editor/nodes/quote-author/' },
        { text: 'styledBox', link: '/editor/nodes/styled-box/' },
        { text: 'styledBox', link: '/editor/nodes/styled-box/' },
        { text: 'styledBoxTitle', link: '/editor/nodes/styled-box-title/' },
        { text: 'styledBoxContent', link: '/editor/nodes/styled-box-content/' },
        { text: 'table', link: '/editor/nodes/table/' },
        { text: 'tableCell', link: '/editor/nodes/table-cell/' },
        { text: 'tableHeader', link: '/editor/nodes/table-header/' },
        { text: 'tableRow', link: '/editor/nodes/table-row/' },
        { text: 'text', link: '/editor/nodes/text/' },
      ]
    },
    {
      text: 'Marks',
      collapsed: false,
      items: [
        { text: 'Marks', link: '/editor/marks/general/' },
        { text: 'bold', link: '/editor/marks/bold/' },
        { text: 'comment', link: '/editor/marks/comment/' },
        { text: 'italic', link: '/editor/marks/italic/' },
        { text: 'link', link: '/editor/marks/link/' },
        { text: 'strike', link: '/editor/marks/strike/' },
        { text: 'subscript', link: '/editor/marks/subscript/' },
        { text: 'superscript', link: '/editor/marks/superscript/' },
        { text: 'underline', link: '/editor/marks/underline/' },
      ]
    },
    {
      text: 'Extensions',
      collapsed: false,
      items: [
        { text: 'Extensions', link: '/editor/extensions/general/' },
        { text: 'addParagraph', link: '/editor/extensions/add-paragraph/' },
        { text: 'anchor', link: '/editor/extensions/anchor/' },
        { text: 'anzutapConfig', link: '/editor/extensions/anzutap-config/' },
        { text: 'characterCount', link: '/editor/extensions/character-count/' },
        { text: 'collaboration', link: '/editor/extensions/collaboration/' },
        { text: 'collaborationCursor', link: '/editor/extensions/collaboration-cursor/' },
        { text: 'dropCursor', link: '/editor/extensions/drop-cursor/' },
        { text: 'gapCursor', link: '/editor/extensions/gap-cursor/' },
        { text: 'history', link: '/editor/extensions/history/' },
        { text: 'linter', link: '/editor/extensions/linter/' },
        { text: 'listKeymap', link: '/editor/extensions/list-keymap/' },
        { text: 'nodePreventDelete', link: '/editor/extensions/node-prevent-delete/' },
        { text: 'nodePreventPaste', link: '/editor/extensions/node-prevent-paste/' },
        { text: 'slashCommands', link: '/editor/extensions/slash-commands/' },
        { text: 'tableCaption', link: '/editor/extensions/table-caption/' },
        { text: 'textAlign', link: '/editor/extensions/text-align/' },
        { text: 'tocGenerate', link: '/editor/extensions/toc-generate/' },
      ]
    },
    {
      text: 'Scraper',
      collapsed: false,
      items: [
        { text: 'Scraper', link: '/editor/scraper/general/' },
        { text: 'dailymotion_video', link: '/editor/scraper/dailymotion_video/' },
        { text: 'facebook_post', link: '/editor/scraper/facebook_post/' },
        { text: 'facebook_video', link: '/editor/scraper/facebook_video/' },
        { text: 'flourish_story', link: '/editor/scraper/flourish_story/' },
        { text: 'flourish_visual', link: '/editor/scraper/flourish_visual/' },
        { text: 'google_document', link: '/editor/scraper/google_document/' },
        { text: 'google_map', link: '/editor/scraper/google_map/' },
        { text: 'idnes_video', link: '/editor/scraper/idnes_video/' },
        { text: 'iframe_basic', link: '/editor/scraper/iframe_basic/' },
        { text: 'instagram_post', link: '/editor/scraper/instagram_post/' },
        { text: 'instagram_reel', link: '/editor/scraper/instagram_reel/' },
        { text: 'jw_video', link: '/editor/scraper/jw_video/' },
        { text: 'pinterest_pin', link: '/editor/scraper/pinterest_pin/' },
        { text: 'podbean_episode', link: '/editor/scraper/podbean_episode/' },
        { text: 'scribd_document', link: '/editor/scraper/scribd_document/' },
        { text: 'soundcloud_track', link: '/editor/scraper/soundcloud_track/' },
        { text: 'spotify_episode', link: '/editor/scraper/spotify_episode/' },
        { text: 'ta3_video', link: '/editor/scraper/ta3_video/' },
        { text: 'tableau_visual', link: '/editor/scraper/tableau_visual/' },
        { text: 'tiktok_video', link: '/editor/scraper/tiktok_video/' },
        { text: 'twitter_post', link: '/editor/scraper/twitter_post/' },
        { text: 'vimeo_video', link: '/editor/scraper/vimeo_video/' },
        { text: 'youtube_video', link: '/editor/scraper/youtube_video/' },
      ]
    },
  ]
}
