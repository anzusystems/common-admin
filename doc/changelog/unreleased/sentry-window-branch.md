planned
===

### Changed

- **`useSentry` no longer tries `window.Sentry` first.** It checked that global before falling back
  to a lazy import of `@sentry/vue`, and the check never once succeeded: `Sentry.init` from the npm
  package does not assign `window.Sentry`, nothing in the fleet assigns it, and no `index.html`
  loads the CDN bundle. The branch only existed to duplicate all four methods. What is left is the
  import path that was doing the work the whole time, with the component tag and the swallowed
  failure in one place instead of eight. Behaviour is unchanged; a page that really does set
  `window.Sentry` — the CDN loader does — is no longer preferred over the package.
