# Common admin components for anzusystems admin projects

Vue library based on vuetify: UI components, composables and utils shared by anzusystems admin projects.

## Getting started
- [Guide](doc/guide/README.md) — installation, i18n, styleguide
- [Editor](doc/editor/README.md) — anzutap content schema and [scraper](doc/editor/scraper/README.md) embed types
- [Local development](README-DEV.md)
- [Tests](src/test/README.md)
- [Changelog](CHANGELOG.md)

## Versioning

Starting with 2.0.0, releases follow [Semantic Versioning](https://semver.org/) with a few edge cases.

- **Patch** (`2.0.x`) — bug fixes only.
- **Minor** (`2.x.0`) — new features, non-critical fixes, internal refactors and dependency updates within their major version.
- **Major** (`x.0.0`) — breaking changes, in the library itself or through a new major version of a dependency.

Every release is described in the [changelog](CHANGELOG.md).

### Semantic Versioning edge cases

#### TypeScript definitions and tooling

A minor release may ship incompatible changes to TypeScript definitions, or changes that `vue-tsc`, eslint or other tooling will point out — a narrower type, a renamed option, a stricter rule in the bundled eslint plugin. Such changes surface when the consumer builds or lints, not at runtime.

#### Rarely used API

A minor release may change or remove API that the consumers barely use, when adapting the few call sites costs less than keeping it. The changelog names every such change and what to do instead.

#### Dependencies

Updating a dependency within its major version is a minor release, even when the dependency brings changes of the kinds above. A new major version of a dependency that the consumers have to follow is a major release.

#### Undocumented and internal API

Only what the package entry exports is public API. Deep imports into `dist`, internal stores, event buses and anything not exported from the package can change in any release.

#### Pre-release versions

Pre-release versions (`2.1.0-beta.*`) are for testing and can change anything at any time.

### Deprecations

A feature may be deprecated in any release when a better replacement exists. Deprecated features keep working and are usually removed in the next major release after they were deprecated.

### Recommended version range

To take only fixes automatically, use a range that locks the current minor (`~2.1.0`) and upgrade to a new minor by hand after reading its changelog. `^2.1.0` takes minor releases too.

## Releasing

Releases are made with [release-tools](https://github.com/anzusystems/release-tools) ([guide](https://github.com/anzusystems/release-tools/blob/main/docs/guide.md)), never by hand:

- `yarn release:start` — starts a release (a branch and a folder of its own) or a hotfix of an older line.
- `yarn release:publish` — publishes a prerelease (`alpha`, `beta`, `rc`), a dev build or the final. The tag is created by the command, CI checks, builds and publishes to npm, and the final is merged into `main`.
- `yarn release:cleanup` — deletes old dev builds and tags that never became a release.
