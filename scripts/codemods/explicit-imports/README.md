# explicit-imports

Scripts that move an admin from `unplugin-auto-import` to explicit imports and sort its imports. They run from
this repository against an admin checkout, with the admin's own tools (TypeScript, `@vue/compiler-sfc`, unimport,
oxlint, oxfmt).

| script | what it does |
|---|---|
| `sort.mjs <admin>` | `oxlint --fix` until nothing changes (at most five passes), then oxfmt; both must then pass in check mode |
| `run.mjs <admin>` | adds the imports and verifies the result; writes `scripts/explicit-imports.manifest.json` in the admin |
| `css-order.mjs <admin> <dist-before> <dist-after>` | compares the CSS of two builds when only the import order changed |
| `test/run-tests.mjs --deps-from <admin>` | runs `run.mjs` over the fixtures and compares with `test/expected/` (`--update` rewrites them) |

## What `run.mjs` does

1. Regenerates `src/auto-imports.d.ts` (`scripts/generate-dts.mjs` of the admin) and reads the names from it:
   values, types, and the modules of `dirs` as `@/…`.
2. Records, for every file of `src/`, what unimport injects today (after the TypeScript is stripped, on the
   compiled script and the compiled template of a component), where each template reference is taken from
   (`$props`, `$setup`, `_ctx`), the runtime props of each component (dev and prod) and the value import graph.
3. Finds the names each file uses without binding them. The TypeScript checker resolves every identifier in a
   program without lib, module resolution or the generated declaration file, so only a declaration in the file
   binds a name; value and type meaning are resolved separately. Template names come from `_ctx.X` of the
   compiled render function, template types (`as IntegerId`, typed slot props, `generic`) from its TypeScript.
   Vue macros are never imported.
4. Adds the imports: into an existing import of the same module when there is one, types as `import type`,
   template names into `<script setup>` (also an empty one).
5. Checks the result and fails on anything not in `scripts/explicit-imports.allowlist.json` of the admin:
   - unimport would still inject a name (`residualInjections`)
   - a name is imported now that unimport did not inject before (`differences`)
   - a template reference changed its target, other than `_ctx.X` to `$setup.X` for a name imported now and
     injected before (`templateTargets`)
   - a prop gained the runtime type `Boolean` or `Function` (`propsTypes`)
   - a new import edge inside a cycle (`cycles`)
   - a prop shadowed by a new import, template names without `<script setup>`, a file that does not compile
     (`problems`)

   An allowlist entry that is not needed is an error too. The format:

   ```json
   {
     "residualInjections": { "src/x.ts": { "ref": "a parameter named ref; unimport does not see parameters" } },
     "cycles": { "src/a.ts -> src/b.ts": "why the cycle is harmless" }
   }
   ```

The manifest lists per file what was added, the changed runtime props, the cycles before and after, the tool
versions, the admin commit it ran on and the commit and archive checksum of these scripts. Changed runtime props
are expected where a global type becomes an imported one: the compiler can now resolve it (`type: null` becomes
`type: Number` for an `IntegerId`), so dev and the tests start validating those props.

## Order in an admin

Commit A, the sorting: `.oxfmtrc.json` `sortImports` with `sortSideEffects: false`, the oxlint rules
`sort-imports`, `import/no-duplicates`, `import/consistent-type-specifier-style` (`import/default` off), then
`sort.mjs`. Gate: `yarn lint:tsc`, `yarn ci`, `yarn build`, and `css-order.mjs` over the builds before and after.

Commit B, the imports, with common-admin copied in by `copy.sh`:

1. `run.mjs` while `unplugin-auto-import` is still installed
2. the config cleanup (vite and vitest config, `autoImports.config.mts`, eslint globals, tsconfig, oxlint ignores,
   `scripts/generate-dts.mjs` deleting the stale generated files), `sort.mjs`, `yarn install`
3. gate: the generated files are gone, `yarn lint:tsc`, `yarn ci`, `yarn build`, `css-order.mjs`

The scripts are rerun after a rebase rather than their output rebased.
