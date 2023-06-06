# Local development

## Prerequisites

- node.js version 16 or higher, lts suggested
- cloned project

## Installation

::: code-group

```sh [yarn]
$ yarn install
```

```sh [npm]
$ npm install
```

:::

## Local development

#### Local playground
You can use `src/views` as a playground to develop and test your features. Put playground code in a separate folder with all code. Do not use other folder structure for playground (except pinia and router).

There is a pinia and vue router available for you to use too. This is just a playground and will be not included inside final build.

You can run development playground using command:
::: code-group

```sh [yarn]
$ yarn playground:dev
```

```sh [npm]
$ npm playground:dev
```

:::

#### Library build

Only features exported in `src/lib.ts` are included in final library build.

::: code-group

```sh [yarn]
$ yarn lib:build
```

```sh [npm]
$ npm lib:build
```

:::


## Local admin development

### Detailed description

If you want to locally develop and test newly created or modified feature in common admin, you need to replace library build files in admin project dependencies.

After running common admin library build command, you need to copy and replace files from common admin project `dist` directory content to admin's `node_modules/@anzusystems/common-admin/dist` directory. If you have changed something special inside common-admin's `package.json`, you need to copy it too.

Then you can run `bin/dev --no-install` on your admin project to refresh dependencies.
::: details More info
`bin/dev --no-install` command inside of admin project also runs `rm -rf node_modules/.vite/deps/` to clear vite deps cache.
:::

::: danger Important
When you refresh your admin, open browser's dev console and disable cache. Otherwise, vite will not provide updated dependencies.
:::

### In short

1. **common-admin**: create/update feature
2. **common-admin**: run `yarn build`
3. Optional, **admin**: make sure you have the latest deps inside of node_modules, you can do by running for example: `bin/dev`, because it will do install and then stopping the vite dev server. Make sure vite dev server is not running.
4. copy **common-admin** `dist` directory content to **admin**'s `node_modules/@anzusystems/common-admin/dist`
5. Optional, copy **common-admin** `package.json` file to **admin**'s `node_modules/@anzusystems/common-admin`, if needed
6. Optional, if you haven't done it before, disable cache in browser dev tools for **admin** page view
7. **admin**, run `bin/dev --no-install`
8. Optional, repeat


## Docs update

Use `docs` directory to update docs.

You can use it also to develop some simple components as you can directly document them.

::: code-group

```sh [yarn]
$ yarn docs:dev
```

```sh [npm]
$ npm docs:dev
```

:::

::: warning
There are differences for `dev` watch mode and real `build` of docs. Always at the end of development/update of docs, if they are really able to build:
:::

::: code-group

```sh [yarn]
$ yarn docs:build
```

```sh [npm]
$ npm docs:build
```

:::


## Lint

Please follow code-style rules including `prettier`, `eslint`, `vue-tsc`, `stylelint`. Pull request CI will check for issues and disallow to merge PR.

You can run all checks using:

::: code-group

```sh [yarn]
$ yarn lint
```

```sh [npm]
$ npm lint
```

:::

Prettier and eslint autofix works very well and can save you a lot of time fixing basic code-style issues. Stylelint autofix can do some trouble so use it with caution. Recommended commands order to autofix is:
::: code-group

```sh [yarn]
$ yarn lint:prettier:fix
$ yarn lint:eslint:fix
```

```sh [npm]
$ npm lint lint:prettier:fix
$ npm lint lint:eslint:fix
```

:::

Check `package.json` for additional commands.
