/** The environments an admin's e2e suite runs against. */
export type E2eEnv = 'local' | 'devel' | 'staging'

export interface LoadE2eEnvOptions {
  /** The e2e project's folder, holding `.env.<env>` (usually `__dirname` of `playwright.config.ts`). */
  dir: string
  /** The env when `E2E_ENV` is not set, e.g. `bin/test` without `-e`. */
  defaultEnv: E2eEnv
  /**
   * A file read first, under `.env.<env>`, which overrides it, e.g. `.env.dist` when it holds the local stack's
   * values. Without it, `.env.<env>` is the only file, and variables already set in the shell win.
   */
  base?: string
}

export type LoadE2eEnv = (options: LoadE2eEnvOptions) => E2eEnv
export type E2eEnvOf = () => E2eEnv
export type E2eEnvLabel = () => string
export type IsLocalStack = () => boolean

export declare const E2E_ENVS: readonly E2eEnv[]

/**
 * Sets `E2E_ENV` (to `defaultEnv` when unset) and loads `<dir>/.env.<env>` into `process.env`. Throws on an env
 * other than `local`, `devel` and `staging`, and when the file of `devel` or `staging` is missing; for `local` a
 * missing file is only a warning. Returns the env.
 */
export declare const loadE2eEnv: LoadE2eEnv

/** The env `loadE2eEnv` set. Throws when it has not run. */
export declare const e2eEnv: E2eEnvOf

/** The env as the suites' titles show it: `LOCAL`, `DEV` or `STG`. */
export declare const e2eEnvLabel: E2eEnvLabel

/** Whether the suite runs against the local Docker stack. */
export declare const isLocalStack: IsLocalStack

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** Set by `loadE2eEnv` in `playwright.config.ts`, so a comparison with another name fails the type check. */
      E2E_ENV: E2eEnv
    }
  }
}
