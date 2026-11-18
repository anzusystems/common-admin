// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'

/**
 * Which environment an admin's e2e suite runs against: one variable, `E2E_ENV`, with the same three names in
 * every admin. `bin/test -e <env>` sets it; left unset, the admin's `playwright.config.ts` picks its default.
 * The env file is read with Node's own parser (`util.parseEnv`), so the package needs no dotenv.
 *
 * @typedef {import('./env.mjs').E2eEnv} E2eEnv
 */

/** @type {readonly E2eEnv[]} */
export const E2E_ENVS = Object.freeze(['local', 'devel', 'staging'])

/** @type {Readonly<Record<E2eEnv, string>>} */
const LABELS = Object.freeze({ local: 'LOCAL', devel: 'DEV', staging: 'STG' })

/**
 * @param {unknown} value
 * @returns {value is E2eEnv}
 */
const isE2eEnv = (value) => typeof value === 'string' && /** @type {readonly string[]} */ (E2E_ENVS).includes(value)

/** @param {unknown} value @param {string} source */
const invalid = (value, source) => new Error(`${source} must be one of ${E2E_ENVS.join(', ')}; got "${String(value)}".`)

/**
 * Sets what the file holds in `process.env`. Without `override`, a variable already set (by the shell or an
 * earlier file) is kept, as dotenv does.
 *
 * @param {string} file
 * @param {boolean} override
 */
const applyEnvFile = (file, override) => {
  const values = parseEnv(fs.readFileSync(file, 'utf8'))
  for (const [key, value] of Object.entries(values)) {
    if (override || process.env[key] === undefined) process.env[key] = value
  }
}

/** @type {import('./env.mjs').LoadE2eEnv} */
export function loadE2eEnv({ dir, defaultEnv, base }) {
  if (!isE2eEnv(defaultEnv)) throw invalid(defaultEnv, 'The default env')
  const env = process.env.E2E_ENV || defaultEnv
  if (!isE2eEnv(env)) throw invalid(env, 'E2E_ENV')

  const envFile = path.resolve(dir, `.env.${env}`)
  const exists = fs.existsSync(envFile)
  // A deployed environment run with the wrong (or no) credentials and URLs would report another environment's
  // results under its name. The local stack runs with the defaults of `.env.dist` or the app's own.
  if (!exists && env !== 'local') {
    throw new Error(`Environment file not found: ${envFile}. Copy .env.dist to .env.${env} and fill it in.`)
  }
  process.env.E2E_ENV = env
  if (base) applyEnvFile(path.resolve(dir, base), false)
  if (exists) applyEnvFile(envFile, Boolean(base))
  else if (!base) console.warn(`Environment file not found: ${envFile}. Copy .env.dist to .env.${env} and fill it in.`)
  return env
}

/** @type {import('./env.mjs').E2eEnvOf} */
export function e2eEnv() {
  const env = process.env.E2E_ENV
  if (!isE2eEnv(env)) {
    throw env
      ? invalid(env, 'E2E_ENV')
      : new Error('E2E_ENV is not set: playwright.config.ts loads it (loadE2eEnv) before any test file.')
  }
  return env
}

/** @type {import('./env.mjs').E2eEnvLabel} */
export const e2eEnvLabel = () => LABELS[e2eEnv()]

/** @type {import('./env.mjs').IsLocalStack} */
export const isLocalStack = () => e2eEnv() === 'local'
