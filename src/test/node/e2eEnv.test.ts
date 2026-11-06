import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { E2E_ENVS, e2eEnv, e2eEnvLabel, isLocalStack, loadE2eEnv } from '@/e2e/env.mjs'

// How an admin's e2e suite picks its environment (src/e2e/env.mjs): `E2E_ENV`, else the admin's default, and the
// env file of that name in its e2e folder.

const VARS = ['E2E_ENV', 'BASE_URL', 'FROM_DIST', 'FROM_SHELL']
let dir: string
let saved: Record<string, string | undefined>

const write = (files: Record<string, string>) => {
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-env-'))
  saved = Object.fromEntries(VARS.map((name) => [name, process.env[name]]))
  for (const name of VARS) delete process.env[name]
})
afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  fs.rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('loadE2eEnv', () => {
  it('takes the default when E2E_ENV is not set, and loads its file', () => {
    write({ '.env.staging': 'BASE_URL=https://staging.example\n' })
    expect(loadE2eEnv({ dir, defaultEnv: 'staging' })).toBe('staging')
    expect(process.env.E2E_ENV).toBe('staging')
    expect(process.env.BASE_URL).toBe('https://staging.example')
  })

  it('takes E2E_ENV over the default, and keeps what the shell set', () => {
    write({ '.env.devel': 'BASE_URL=https://devel.example\nFROM_SHELL=file\n' })
    process.env.E2E_ENV = 'devel'
    process.env.FROM_SHELL = 'shell'
    expect(loadE2eEnv({ dir, defaultEnv: 'staging' })).toBe('devel')
    expect(process.env.BASE_URL).toBe('https://devel.example')
    expect(process.env.FROM_SHELL).toBe('shell')
  })

  it('refuses a name other than local, devel and staging', () => {
    process.env.E2E_ENV = 'stg' as typeof process.env.E2E_ENV
    expect(() => loadE2eEnv({ dir, defaultEnv: 'staging' })).toThrow(
      'E2E_ENV must be one of local, devel, staging; got "stg".'
    )
    // E2E_ENV is typed as set (src/e2e/env.d.mts), as it is once playwright.config.ts has run.
    Reflect.deleteProperty(process.env, 'E2E_ENV')
    expect(() => loadE2eEnv({ dir, defaultEnv: 'dev' as 'devel' })).toThrow(/^The default env must be one of/)
  })

  it('stops when the file of a deployed environment is missing, and only warns for the local stack', () => {
    expect(() => loadE2eEnv({ dir, defaultEnv: 'devel' })).toThrow(
      `Environment file not found: ${path.join(dir, '.env.devel')}. Copy .env.dist to .env.devel and fill it in.`
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(loadE2eEnv({ dir, defaultEnv: 'local' })).toBe('local')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('.env.local'))
  })

  it('reads a base file first and lets the env file override it', () => {
    write({ '.env.dist': 'BASE_URL=http://local.example\nFROM_DIST=dist\n', '.env.staging': 'BASE_URL=https://stg\n' })
    loadE2eEnv({ dir, defaultEnv: 'staging', base: '.env.dist' })
    expect(process.env.BASE_URL).toBe('https://stg')
    expect(process.env.FROM_DIST).toBe('dist')
  })

  it('runs the local stack on the base file alone, without a warning', () => {
    write({ '.env.dist': 'BASE_URL=http://local.example\n' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadE2eEnv({ dir, defaultEnv: 'local', base: '.env.dist' })
    expect(process.env.BASE_URL).toBe('http://local.example')
    expect(warn).not.toHaveBeenCalled()
  })

  it('still stops on a missing file of a deployed environment when there is a base', () => {
    write({ '.env.dist': 'BASE_URL=http://local.example\n' })
    expect(() => loadE2eEnv({ dir, defaultEnv: 'staging', base: '.env.dist' })).toThrow(/\.env\.staging/)
  })
})

describe('e2eEnv, e2eEnvLabel, isLocalStack', () => {
  it('read the env loadE2eEnv set', () => {
    expect(E2E_ENVS).toEqual(['local', 'devel', 'staging'])
    const labels = E2E_ENVS.map((env) => {
      process.env.E2E_ENV = env
      return [e2eEnv(), e2eEnvLabel(), isLocalStack()]
    })
    expect(labels).toEqual([
      ['local', 'LOCAL', true],
      ['devel', 'DEV', false],
      ['staging', 'STG', false],
    ])
  })

  it('throw when it was not set, or set to another name', () => {
    expect(() => e2eEnvLabel()).toThrow(/^E2E_ENV is not set/)
    process.env.E2E_ENV = 'stg' as typeof process.env.E2E_ENV
    expect(() => isLocalStack()).toThrow(/got "stg"/)
  })
})
