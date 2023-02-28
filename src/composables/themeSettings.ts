import { computed, readonly, ref } from 'vue'
import { useStorage } from '@vueuse/core'

export enum ThemeSettings {
  Light = 'light',
  Dark = 'dark',
  Auto = 'auto',
}

export enum Theme {
  Light = 'light',
  Dark = 'dark',
}

const storedSettings = useStorage('theme', ThemeSettings.Light)

const QUERY = '(prefers-color-scheme: dark)'

const settings = ref<ThemeSettings>(
  Object.values(ThemeSettings).some((val) => val === storedSettings.value)
    ? <ThemeSettings>storedSettings.value
    : ThemeSettings.Light
)
const theme = ref<Theme>(Theme.Light)
const systemHasDarkPreference = ref(window.matchMedia && window.matchMedia(QUERY).matches)

const setTheme = () => {
  switch (settings.value) {
    case ThemeSettings.Auto:
      theme.value = systemHasDarkPreference.value ? Theme.Dark : Theme.Light
      break
    case ThemeSettings.Light:
      theme.value = Theme.Light
      break
    case ThemeSettings.Dark:
      theme.value = Theme.Dark
      break
  }
}
setTheme()

const setThemeSettings = (value: ThemeSettings) => {
  settings.value = value
  storedSettings.value = value
}

window.matchMedia(QUERY).addEventListener('change', (event) => {
  systemHasDarkPreference.value = event.matches
  setTheme()
})

const toolbarColor = computed(() => {
  return theme.value === Theme.Light ? 'white' : '#1A1A1A'
})

export function useTheme() {
  const setThemeAuto = () => {
    setThemeSettings(ThemeSettings.Auto)
    setTheme()
  }

  const setThemeDark = () => {
    setThemeSettings(ThemeSettings.Dark)
    setTheme()
  }

  const setThemeLight = () => {
    setThemeSettings(ThemeSettings.Light)
    setTheme()
  }

  const toggleTheme = () => {
    switch (settings.value) {
      case ThemeSettings.Light:
        setThemeDark()
        break
      case ThemeSettings.Dark:
        setThemeAuto()
        break
      default:
        setThemeLight()
        break
    }
  }

  return {
    settings: readonly(settings),
    theme: readonly(theme),
    toolbarColor: readonly(toolbarColor),
    toggleTheme,
    setThemeAuto,
    setThemeDark,
    setThemeLight,
  }
}
