import type { Route } from 'playwright'

// Pages for the route walk's tests, served by a browser context's router: no server runs.

export const ORIGIN = 'http://walk.test'

/** An app page: a `main` that holds `main`, then a script. */
export const app = (main: string, script = '') =>
  `<!doctype html><html><head></head><body><main style="display:block;min-height:200px">${main}</main>` +
  `<script>${script}</script></body></html>`

/** A page whose app never renders. */
export const BLANK = '<!doctype html><p>Starting</p>'

// A page's chunk that arrives late and mounts a card that keeps loading.
const LATE_LOADER = `document.querySelector('main').insertAdjacentHTML('beforeend',
  '<div style="position:relative">Card<div class="a-card-loader" style="position:absolute;inset:0"></div></div>')`

const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface PageServer {
  /** Pages by pathname; anything else of the origin answers 404, as does every other origin. */
  pages: Record<string, string | (() => string)>
  /** For `context.route('**\/*', server.serve)`. */
  serve: (route: Route) => Promise<void>
  /** Ends the requests that never get an answer. */
  release: () => Promise<void>
}

/**
 * Besides the pages: `/api/ok` (200), `/api/broken` (500), `/api/slow` (200 after 1 s), `/api/poll` (200 after
 * 300 ms), `/api/refused` (refused),
 * `/api/hang` and `/notifications/stream/*` (no answer), `/server-error` (a page answering 500) and
 * `/assets/late-loader.js` (a page chunk after 400 ms).
 */
export function pageServer(): PageServer {
  const pages: PageServer['pages'] = {}
  const held: Route[] = []
  return {
    pages,
    async serve(route) {
      const url = new URL(route.request().url())
      const at = url.pathname
      const body = pages[at]
      if (url.origin !== ORIGIN) return route.fulfill({ status: 404 })
      if (body !== undefined) {
        return route.fulfill({ contentType: 'text/html', body: typeof body === 'function' ? body() : body })
      }
      if (at === '/api/ok') return route.fulfill({ contentType: 'application/json', body: '{}' })
      if (at === '/api/broken') return route.fulfill({ status: 500 })
      if (at === '/api/slow' || at === '/api/poll') {
        await after(at === '/api/slow' ? 1_000 : 300)
        return route.fulfill({ contentType: 'application/json', body: '{}' })
      }
      if (at === '/api/refused') return route.abort('connectionrefused')
      if (at === '/server-error') return route.fulfill({ status: 500, contentType: 'text/html', body: app('Error') })
      if (at === '/api/hang' || at.startsWith('/notifications/stream/')) return void held.push(route)
      if (at === '/assets/late-loader.js') {
        await after(400)
        return route.fulfill({ contentType: 'text/javascript', body: LATE_LOADER })
      }
      return route.fulfill({ status: 404 })
    },
    async release() {
      await Promise.all(held.map((route) => route.abort().catch(() => {})))
    },
  }
}
