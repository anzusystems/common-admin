import { VBtn } from 'vuetify/components'
import { VChip } from 'vuetify/components'

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
            'on-surface': '#333',
            primary: '#3f6ad8',
            secondary: '#E0E0E0',
            'on-secondary': '#333',
            success: '#3ac47d',
            'on-success': '#fff',
            warning: '#FB8C00',
            error: '#d92550',
            info: '#78c3fb',
          },
          variables: {},
        },
        dark: {
          dark: true,
          colors: {
            background: '#1A1A1A',
            surface: '#1A1A1A',
            primary: '#3f6ad8',
            secondary: '#E0E0E0',
            'on-secondary': '#333',
            success: '#3ac47d',
            warning: '#FB8C00',
            error: '#d92550',
            info: '#78c3fb',
          },
          variables: {},
        },
      },
    }
  }

  const commonDefaults = () => {
    return {
      global: {},
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
      },
      VCombobox: {
        variant: 'underlined',
        density: 'compact',
        color: 'primary',
      },
      VSwitch: {
        color: 'success',
      },
      VCard: {
        variant: 'flat',
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
      AChipNoLink: VChip as any,
    }
  }

  return {
    commonAliases,
    commonDefaults,
    commonTheme,
  }
}
