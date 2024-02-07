# Local development

## Prerequisites

- node.js latest version 20
- enable corepack, so yarn v4 from package.json will be used
- copy `.env` to `.env.local` and update paths inside (COMMON_ADMIN_PROJECT and ADMIN_PROJECT)

## Installation

```sh [yarn]
$ yarn install
```

## Local development

#### Local playground
You can use `src/views` as a playground to develop and test your features. Put playground code in a separate folder with all code. Do not use other folder structure for playground (except pinia and router).

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
4. **admin**: Make sure vite dev server is not running.
5. **common-admin** run `/.copy.sh`
6. **common-admin** optional, if you haven't done it before, disable cache in browser dev tools for **admin** page view
7. **admin**, run `bin/dev --no-install` (it will start dev server without node_modules update so copied build files of common admin are used)
8. Optional, repeat

::: details More info
`bin/dev --no-install` command inside of admin project also runs `rm -rf node_modules/.vite/deps/` to clear vite deps cache.
:::

::: danger Important
When you refresh your admin, open browser's dev console and disable cache. Otherwise, vite will not provide updated dependencies.
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

Please follow code-style rules including `prettier`, `eslint`, `vue-tsc`, `stylelint`. Pull request CI will check for issues and disallow to merge PR.

You can run all checks using:

```sh [yarn]
$ yarn lint
```

Prettier and eslint autofix works very well and can save you a lot of time fixing basic code-style issues. Stylelint autofix can do some trouble so use it with caution. Recommended commands order to autofix is:

```sh [yarn]
$ yarn lint:prettier:fix
$ yarn lint:eslint:fix
```

Check `package.json` for additional commands.
