const navigatorLanguage = (): string =>
  navigator.languages?.length
    ? navigator.languages[0]!
    : ((navigator as Navigator & { userLanguage?: string }).userLanguage ?? navigator.language ?? 'en')

// Shown in `#app` when the admin cannot start: nothing else of it can render yet.
const showFatalError = () => {
  const lang = navigatorLanguage()
  const message =
    lang === 'sk-SK' || lang === 'sk'
      ? 'Fatálna chyba. Prosím kontaktujte administrátora.'
      : 'Fatal error. Please contact administrator.'
  const div = document.createElement('div')
  div.style.cssText = 'color:red;text-align:center;font-weight:bold;margin:20px;'
  div.textContent = message
  document.getElementById('app')?.appendChild(div)
}

const fetchEnvConfig = async (url: string): Promise<object> => {
  const response = await fetch(url + '?random=' + Date.now())
  if (!response.ok) {
    throw new Error('Unable to load env config. Incorrect response code.')
  }
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Unable to load env config. Incorrect content type.')
  }
  const config = await response.json()
  if (Object.keys(config).length < 1) {
    throw new Error('Unable to load env config. Incorrect response body.')
  }
  return config
}

/**
 * Loads the deployed `config.json` (never from a cache), hands it to `apply`, then runs `start`, the
 * admin's start-up. Either failing shows the fatal error in `#app`. A failed start is reported as
 * what it is, through `reportError` (so an error handler already installed, Sentry's, sees it), not
 * as a config that did not load.
 */
export async function startWithEnvConfig<T extends object>(
  apply: (config: T) => void,
  start: () => void | Promise<void>,
  options: { url?: string } = {}
): Promise<void> {
  try {
    apply((await fetchEnvConfig(options.url ?? '/config.json')) as T)
  } catch (error) {
    showFatalError()
    console.error(error)
    return
  }
  try {
    await start()
  } catch (error) {
    showFatalError()
    if (typeof reportError === 'function') reportError(error)
    else console.error(error)
  }
}
