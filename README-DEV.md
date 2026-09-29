# Local development

## Prerequisites

- node.js 24 (matches CI; Vitest 5 requires >= 22.12)
- enable corepack, so yarn v4 from package.json will be used
- copy [`.env`](.env) to `.env.local` and update paths inside (`COMMON_ADMIN_PROJECT` and `ADMIN_PROJECT`); more admins: colon separated `ADMIN_PROJECT=/path/admin-cms:/path/admin-ugc` or bash array `ADMIN_PROJECTS=("/path/admin-cms" "/path/admin-ugc")`

## Installation

```sh
$ yarn install
```

Browser tests need Chromium, installed once (`yarn install` does not do it):

```sh
$ npx playwright install chromium --with-deps
```

## Local development

#### Local playground
You can use `src/playground` as a playground to develop and test your features. Put playground code in a separate folder with all code. Do not use other folder structure for playground.

There is a pinia and vue router available for you to use too. This is just a playground and will be not included inside final build.

You can run development playground using command, it serves on `http://common-admin.sme.localhost:5173`:

```sh
$ yarn playground:dev
```

#### Library build

Only features exported in [`src/lib.ts`](src/lib.ts) are included in final library build.

```sh
$ yarn lib:build
```

## Local admin development

### In short

1. **common-admin**: create/update feature
2. **common-admin**: run `yarn build` (`yarn build:dev` for an unminified build with source maps)
3. **admin** optional: make sure you have the latest deps inside of node_modules (`bin/dev` and then stop the server, or `bin/bash` and `yarn install`)
4. **admin**: run `bin/dev --no-install` (it will start dev server without node_modules update so copied build files of common admin are used)
5. **common-admin** run `./copy.sh` (the admins from `.env.local`), or `./copy.sh /path/to/admin-cms` for the admins given
6. Optional, repeat 1, 2 and 5

<details>
<summary>More info</summary>

[`copy.sh`](copy.sh) refuses to run when `dist` lacks `common-admin.js`, `.d.ts` or `.css` (an unfinished build), then copies `dist`, `package.json`, `src/eslint` and `src/vite` into `node_modules/@anzusystems/common-admin` of each admin, clears `node_modules/.vite/deps/` and `node_modules/.cache/tsc/` (vue-tsc's build info, which would otherwise call the admin up to date against the old declarations) and empties `.common-admin-updated`. The `commonAdminDevWatch` plugin in the admin's `vite.config.mts` (the admins used to carry a copy, `watchCommonAdmin`) watches this file and restarts the dev server, which bundles the new library again and reloads the page. A plain full reload is not enough with Vite 8: the page would keep running the previous build.

`bin/dev --no-install` command inside of admin project also runs `rm -rf node_modules/.vite/deps/` to clear vite deps cache.

</details>

> [!TIP]
> If the admin still serves the previous build (a branch with the older watcher, which only reloaded the page), restart it with `bin/dev --no-install`.

### Watch mode (`yarn dev:admin`)

Instead of steps 2 and 5: `yarn dev:admin` rebuilds the library on every change (JavaScript and CSS, no declarations, about 0.7 s) and copies only the files that changed into the admins from `.env.local` (or `COMMON_ADMIN_TARGETS=/path/a:/path/b`), then writes their names into `.common-admin-updated`. Declarations stay those of the last `yarn build && ./copy.sh`; `yarn dev:admin:types` (a full build, ~17 s, alongside the watch) refreshes only them. `package.json`, `src/eslint` and `src/vite` go into an admin only with a full copy (the session's first build, or the first after `./copy.sh` or after the package in the admin's `node_modules` was reinstalled): after changing the eslint or Vite plugins, restart the watch, then stop and start the admin's dev server — it loads `@anzusystems/common-admin/vite` once per process, and its own restarts do not reload it.

What the admin does with the update is up to its `vite.config.mts`:

- `commonAdminDevWatch()` from `@anzusystems/common-admin/vite` (common-admin pre-bundled, the default): the dev server restarts with a re-optimization, the page shows the change in ~4.5 s. Each restart keeps some memory in Vite 8.3 ([vitejs/vite#23493](https://github.com/vitejs/vite/issues/23493)), so after many changes restart the dev server.
- `commonAdminDevWatch({ prebundle: process.env.COMMON_ADMIN_PREBUNDLE !== '0' })` started with `COMMON_ADMIN_PREBUNDLE=0` (in Docker: `.env.docker.local`), recommended with `yarn dev:admin`: common-admin is not pre-bundled, the changed files are invalidated and the page reloads, ~1.3 s, no restart. The server restarts instead after a full copy (the session's first build, `./copy.sh`) and when a change imports a package the library did not import before, so that it gets pre-bundled. What the admin excludes from pre-bundling itself (`optimizeDeps.exclude`) stays excluded for the library too.

`yarn dev:admin` builds the library as one bundle and its lazy chunks (`COMMON_ADMIN_DEV_BUNDLE=1`), not one file per module as published: unbundled, its ~800 modules on top of the admin's own made every third reload fail in Chrome (`ERR_INSUFFICIENT_RESOURCES`). A `./copy.sh` puts the per-module build back; use the pre-bundled mode with `copy.sh` alone.

(Measured on admin-blog in Chromium, from saving a library file to the change on the page, under yarn and under pnpm.)

For an admin installed with pnpm the same applies (the library itself still runs `yarn dev:admin` and `./copy.sh`). There `node_modules/@anzusystems/common-admin` is a symlink into the project's virtual store, and the files in it are hard links into pnpm's global store; both the watch and `copy.sh` put a new file in place of an old one instead of writing into it, so the store stays untouched. A dev copy survives a `pnpm install` that finds nothing to change ("Already up to date"); removing the admin's `node_modules` and installing again restores the published version, and the watch then copies everything again on its next build.

## Lint

Please follow code-style rules including `oxfmt`, `oxlint`, `eslint`, `vue-tsc`, `stylelint`. Pull request CI will check for issues (`yarn ci`), run tests (`yarn test:run`, see [`src/test/README.md`](src/test/README.md)) and disallow to merge PR.

You can run all checks using:

```sh
$ yarn lint
```

oxfmt, oxlint and eslint autofix works very well and can save you a lot of time fixing basic code-style issues. Stylelint autofix can do some trouble so use it with caution (`yarn lint --fix` runs all autofixes including stylelint). Recommended commands order to autofix is:

```sh
$ yarn lint:oxlint:fix
$ yarn lint:eslint:fix
$ yarn format
```

Check `package.json` for additional commands.
