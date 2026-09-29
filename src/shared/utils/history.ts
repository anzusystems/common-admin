import type { RouteLocationRaw, Router } from 'vue-router'

export const browserHistoryReplaceUrlByString = (path: string) => {
  history.replaceState(history.state, '', path)
}

export const browserHistoryReplaceUrlByRouter = (router: Router, to: RouteLocationRaw) => {
  const resolved = router.resolve(to)
  browserHistoryReplaceUrlByString(resolved.href)
}
