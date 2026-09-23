# Local development

## Prerequisites

- node.js 24 (matches CI; Vitest 5 requires >= 22.12)
- enable corepack, so yarn v4 from package.json will be used
- copy `.env` to `.env.local` and update paths inside (`COMMON_ADMIN_PROJECT` and `ADMIN_PROJECT`); more admins: colon separated `ADMIN_PROJECT=/path/admin-cms:/path/admin-ugc` or bash array `ADMIN_PROJECTS=("/path/admin-cms" "/path/admin-ugc")`

## Installation

```sh [yarn]
$ yarn install
```

## Local development

#### Local playground
You can use `src/playground` as a playground to develop and test your features. Put playground code in a separate folder with all code. Do not use other folder structure for playground (except router in `src/router/playground.ts`).

There is a pinia and vue router available for you to use too. This is just a playground and will be not included inside final build.

You can run development playground using command:

```sh [yarn]
$ yarn playground:dev
```

#### Library build

Only features exported in `src/lib.ts` are included in final library build.

```sh [yarn]
$ yarn lib:build
```

## Local admin development

### In short

1. **common-admin**: create/update feature
2. **common-admin**: run `yarn build`
3. **admin** optional: make sure you have the latest deps inside of node_modules (`bin/dev` and then stop the server, or `bin/bash` and `yarn install`)
4. **admin**: run `bin/dev --no-install` (it will start dev server without node_modules update so copied build files of common admin are used)
5. **common-admin** run `./copy.sh`
6. Optional, repeat 1, 2 and 5

::: details More info
`copy.sh` copies `dist`, `package.json` and `src/eslint` into `node_modules/@anzusystems/common-admin` of each admin, clears `node_modules/.vite/deps/` and touches `.common-admin-updated`. The `watchCommonAdmin` plugin in admin's `vite.config.mts` watches this file, invalidates common-admin modules and does a full reload of the page.

`bin/dev --no-install` command inside of admin project also runs `rm -rf node_modules/.vite/deps/` to clear vite deps cache.
:::

::: tip
If admin still serves the previous build, restart it with `bin/dev --no-install` and disable cache in browser dev tools.
:::

## Docs update

Use `docs` directory to update docs.

You can use it also to develop some simple components as you can directly document them.

```sh [yarn]
$ yarn docs:dev
```

::: warning
There are differences for `dev` watch mode and real `build` of docs. Always at the end of development/update of docs, if they are really able to build:
:::

```sh [yarn]
$ yarn docs:build
```

## Lint

Please follow code-style rules including `oxfmt`, `oxlint`, `eslint`, `vue-tsc`, `stylelint`. Pull request CI will check for issues (`yarn ci`), run tests (`yarn test:run`, see `src/test/README.md`) and disallow to merge PR.

You can run all checks using:

```sh [yarn]
$ yarn lint
```

oxfmt, oxlint and eslint autofix works very well and can save you a lot of time fixing basic code-style issues. Stylelint autofix can do some trouble so use it with caution (`yarn lint --fix` runs all autofixes including stylelint). Recommended commands order to autofix is:

```sh [yarn]
$ yarn lint:oxlint:fix
$ yarn lint:eslint:fix
$ yarn format
```

Check `package.json` for additional commands.
