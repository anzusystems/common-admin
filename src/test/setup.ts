import { config } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import { createPinia } from 'pinia'
import { vi } from 'vitest'
// Import Vuetify styles for browser testing
import 'vuetify/styles'
// Import Material Design Icons
import '@mdi/font/css/materialdesignicons.css'
// Import locale messages directly
import en from '@/locales/en'
// Import Vuetify components and directives
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { useCommonVuetifyConfig } from '@/plugins/commonVuetifyConfig'

// Create Vuetify instance for testing. The library's aliases, so `ABtnPrimary` and its siblings are real
// buttons; its defaults and theme only where a suite asks for them (`support/commonVuetify.ts`).
const vuetify = createVuetify({
  components,
  directives,
  aliases: useCommonVuetifyConfig().commonAliases(),
})

// Create i18n instance for testing with loaded messages
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en,
  },
})

// Create Pinia instance for testing
const pinia = createPinia()

// Configure Vue Test Utils global plugins
config.global.plugins = [vuetify, i18n, pinia]

// Mock window.matchMedia for Vuetify.
// `(any-pointer: fine)` answers TRUE: the default test environment stands in for a desktop with a
// mouse, so list editors offer the drag handle. `useIsTouchDevice()` negates this query, and a blanket
// `matches:false` would make every suite look like a touch-only device and silently disable drag.
// Tests that want a touch-only device override `window.matchMedia` themselves before mounting.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('any-pointer: fine'),
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver (handle both browser and node environments)
const globalThis_ = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : window

if (!globalThis_.ResizeObserver) {
  globalThis_.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
}

// Mock IntersectionObserver
if (!globalThis_.IntersectionObserver) {
  globalThis_.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
}
