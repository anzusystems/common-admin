import type { RouteLocationRaw, Router } from 'vue-router'

export const replaceBrowserHistoryURLByString = (path: string) => {
  history.replaceState(history.state, '', path)
}

export const replaceBrowserHistoryURLByRouter = (router: Router, to: RouteLocationRaw) => {
  const resolved = router.resolve(to)
  replaceBrowserHistoryURLByString(resolved.href)
}
