import { type I18n, useI18n } from 'vue-i18n'
import { createVuetify, type VuetifyOptions } from 'vuetify'
import { VBtn } from 'vuetify/components'
import { Intersect } from 'vuetify/directives'
import { createVueI18nAdapter } from 'vuetify/locale/adapters/vue-i18n'

export const useCommonVuetifyConfig = () => {
  const commonTheme = () => {
    return {
      defaultTheme: 'light',
      variations: {
        colors: [],
        lighten: 0,
        darken: 0,
      },
      themes: {
        light: {
          dark: false,
          colors: {
            background: '#ffffff',
            surface: '#ffffff',
            'on-surface': '#333333',
            primary: '#3f6ad8',
            'on-primary': '#ffffff',
            secondary: '#e0e0e0',
            'on-secondary': '#333333',
            success: '#3ac47d',
            'on-success': '#ffffff',
            warning: '#fb8c00',
            'on-warning': '#ffffff',
            error: '#d92550',
            'on-error': '#ffffff',
            info: '#78c3fb',
            'on-info': '#333333',
          },
          variables: {},
        },
        dark: {
          dark: true,
          colors: {
            background: '#1a1a1a',
            'on-background': '#ffffff',
            surface: '#1a1a1a',
            'on-surface': '#ffffff',
            primary: '#3f6ad8',
            'on-primary': '#ffffff',
            secondary: '#e0e0e0',
            'on-secondary': '#333333',
            success: '#3ac47d',
            'on-success': '#ffffff',
            warning: '#fb8c00',
            'on-warning': '#ffffff',
            error: '#d92550',
            'on-error': '#ffffff',
            info: '#78c3fb',
            'on-info': '#333333',
          },
          variables: {},
        },
      },
    }
  }

  const commonDefaults = () => {
    // No input can hover (a touch screen): a tap emulates the hover and focus a tooltip opens on, and nothing
    // ever ends them, so the tooltip stayed open. There it opens neither way.
    const touchOnly = typeof window !== 'undefined' && !!window.matchMedia?.('(any-hover: none)').matches
    return {
      global: {},
      VTooltip: touchOnly ? { openOnHover: false, openOnFocus: false } : {},
      VTextField: {
        variant: 'underlined',
        density: 'compact',
        color: 'primary',
      },
      VTextarea: {
        variant: 'underlined',
        density: 'compact',
        color: 'primary',
      },
      VSelect: {
        variant: 'underlined',
        density: 'compact',
        color: 'primary',
      },
      VAutocomplete: {
        variant: 'underlined',
        density: 'compact',
        color: 'primary',
        clearOnSelect: true,
      },
      VCombobox: {
        variant: 'underlined',
        density: 'compact',
        color: 'primary',
      },
      VNumberInput: {
        variant: 'underlined',
        density: 'compact',
        color: 'primary',
      },
      VSwitch: {
        color: 'success',
        density: 'compact',
      },
      VCard: {
        variant: 'flat',
      },
      VDialog: {
        noClickAnimation: true,
        persistent: true,
        scrollable: true,
      },
      VProgressCircular: {
        color: 'primary',
      },
      VBtn: {
        variant: 'flat',
      },
      ABtnPrimary: {
        variant: 'flat',
        color: 'primary',
      },
      ABtnSecondary: {
        variant: 'outlined',
        color: 'primary',
      },
      ABtnTertiary: {
        variant: 'text',
        color: 'primary',
      },
      ABtnIcon: {
        variant: 'text',
        icon: true,
      },
    }
  }

  const commonAliases = () => {
    return {
      ABtnPrimary: VBtn as any,
      ABtnSecondary: VBtn as any,
      ABtnTertiary: VBtn as any,
      ABtnIcon: VBtn as any,
    }
  }

  return {
    commonAliases,
    commonDefaults,
    commonTheme,
  }
}

export interface CreateAnzuVuetifyOptions {
  /** The admin's vue-i18n instance, in composition mode: Vuetify's own texts are translated through it. */
  i18n: I18n<any, any, any, string, false>
  /** Merged over the common defaults per component, the way admin-ugc sets `VDataTableServer`. */
  defaults?: VuetifyOptions['defaults']
}

/**
 * The Vuetify instance every admin created in its own `vuetify.ts`, identical in all six: the common
 * aliases, theme and defaults, texts through the admin's i18n, the `Intersect` directive. The stylesheets
 * (`vuetify/styles`, the icon font) stay imported by the admin, where their order is decided.
 */
export function createAnzuVuetify({ i18n, defaults }: CreateAnzuVuetifyOptions) {
  const { commonTheme, commonAliases, commonDefaults } = useCommonVuetifyConfig()
  return createVuetify({
    aliases: commonAliases(),
    locale: {
      adapter: createVueI18nAdapter({ i18n, useI18n }),
    },
    directives: { Intersect },
    theme: commonTheme(),
    defaults: { ...commonDefaults(), ...defaults },
  })
}
