import { createRequire } from 'module'
import { defineConfig } from 'vitepress'

const require = createRequire(import.meta.url)
const pkg = require('@anzusystems/common-admin/package.json')

// https://vitepress.dev/reference/site-config
export default defineConfig({
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
      '/api/': sidebarApi()
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
      link: '/api/list',
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
        { text: 'Buttons', link: '/styleguide/buttons' },
        { text: 'Form', link: '/styleguide/form' },
        { text: 'Dialog', link: '/styleguide/dialog' },
        { text: 'Views', link: '/styleguide/views' },
        { text: 'Other', link: '/styleguide/other' },
      ]
    },
  ]
}

function sidebarApi() {
  return [
    {
      text: 'Api',
      items: [
        { text: 'Site Config', link: '/reference/site-config' },
        { text: 'Frontmatter Config', link: '/reference/frontmatter-config' },
        { text: 'Runtime API', link: '/reference/runtime-api' },
        { text: 'CLI', link: '/reference/cli' },
        {
          text: 'Default Theme',
          items: [
            {
              text: 'Overview',
              link: '/reference/default-theme-config'
            },
            {
              text: 'Nav',
              link: '/reference/default-theme-nav'
            },
            {
              text: 'Sidebar',
              link: '/reference/default-theme-sidebar'
            },
            {
              text: 'Home Page',
              link: '/reference/default-theme-home-page'
            },
            {
              text: 'Footer',
              link: '/reference/default-theme-footer'
            },
            {
              text: 'Layout',
              link: '/reference/default-theme-layout'
            },
            {
              text: 'Badge',
              link: '/reference/default-theme-badge'
            },
            {
              text: 'Team Page',
              link: '/reference/default-theme-team-page'
            },
            {
              text: 'Prev / Next Links',
              link: '/reference/default-theme-prev-next-links'
            },
            {
              text: 'Edit Link',
              link: '/reference/default-theme-edit-link'
            },
            {
              text: 'Last Updated Timestamp',
              link: '/reference/default-theme-last-updated'
            },
            {
              text: 'Search',
              link: '/reference/default-theme-search'
            },
            {
              text: 'Carbon Ads',
              link: '/reference/default-theme-carbon-ads'
            }
          ]
        }
      ]
    }
  ]
}
