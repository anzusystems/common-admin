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

// Create Vuetify instance for testing
const vuetify = createVuetify({
  components,
  directives,
})

// Create i18n instance for testing with loaded messages
const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en
  }
})

// Create Pinia instance for testing
const pinia = createPinia()

// Configure Vue Test Utils global plugins
config.global.plugins = [vuetify, i18n, pinia]

// Mock window.matchMedia for Vuetify
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
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
const globalThis_ = typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : window)

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
