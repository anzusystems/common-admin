import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { devCopyToAdmins } from '../../../scripts/vite/devCopyToAdmins.mjs'

const PACKAGE = 'node_modules/@anzusystems/common-admin'
let root: string
let library: string
let admin: string
let outDir: string

const write = (file: string, content: string) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}
const adminFile = (file: string) => join(admin, PACKAGE, 'dist', file)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'anzu-devcopy-'))
  library = join(root, 'library')
  admin = join(root, 'admin')
  outDir = join(library, 'out')
  write(join(library, 'package.json'), '{"name":"@anzusystems/common-admin"}')
  write(join(library, 'src/eslint/plugin.mjs'), '')
  write(join(library, 'src/vite/index.mjs'), '')
  write(join(admin, 'package.json'), '{}')
  vi.stubEnv('COMMON_ADMIN_TARGETS', admin)
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
})

type Hook = (this: { warn: (message: string) => void }, options: { dir: string }, bundle: object) => void

// One watch cycle: the files a build wrote, then the plugin's `writeBundle`.
function setup() {
  const plugin = devCopyToAdmins()
  ;(plugin.configResolved as (config: object) => void)({ root: library })
  const handler = (plugin.writeBundle as { handler: Hook }).handler
  return (files: Record<string, string>) => {
    rmSync(outDir, { recursive: true, force: true })
    for (const [file, content] of Object.entries(files)) write(join(outDir, file), content)
    ;(plugin.buildStart as () => void)()
    handler.call({ warn: () => {} }, { dir: outDir }, Object.fromEntries(Object.keys(files).map((file) => [file, {}])))
  }
}

describe('devCopyToAdmins', () => {
  it('first build: copies everything, replaces what a previous build left, keeps the declarations', () => {
    write(adminFile('old.js'), 'stale')
    write(adminFile('common-admin.d.ts'), 'types')
    const cycle = setup()
    cycle({ 'common-admin.js': 'a', 'components/AFoo.js': 'b' })
    expect(readFileSync(adminFile('components/AFoo.js'), 'utf8')).toBe('b')
    expect(existsSync(adminFile('old.js'))).toBe(false)
    expect(readFileSync(adminFile('common-admin.d.ts'), 'utf8')).toBe('types')
    expect(readFileSync(join(admin, PACKAGE, 'package.json'), 'utf8')).toContain('common-admin')
    expect(existsSync(join(admin, PACKAGE, 'src/vite/index.mjs'))).toBe(true)
    expect(readFileSync(join(admin, '.common-admin-updated'), 'utf8')).toBe('*\n')
  })

  it('later builds: copies only what changed, removes what is gone, and lists both in the trigger', () => {
    const cycle = setup()
    cycle({ 'common-admin.js': 'a', 'components/AFoo.js': 'b', 'components/ABar.js': 'c' })
    cycle({ 'common-admin.js': 'a', 'components/AFoo.js': 'B' })
    expect(readFileSync(adminFile('components/AFoo.js'), 'utf8')).toBe('B')
    expect(existsSync(adminFile('components/ABar.js'))).toBe(false)
    expect(readFileSync(join(admin, '.common-admin-updated'), 'utf8')).toBe('components/AFoo.js\ncomponents/ABar.js\n')
  })

  it('copies and lists each source map once (rolldown lists them among the output)', () => {
    const cycle = setup()
    cycle({ 'common-admin.js': 'a', 'common-admin.js.map': '{"v":1}' })
    cycle({ 'common-admin.js': 'b', 'common-admin.js.map': '{"v":2}' })
    expect(readFileSync(adminFile('common-admin.js.map'), 'utf8')).toBe('{"v":2}')
    expect(readFileSync(join(admin, '.common-admin-updated'), 'utf8')).toBe('common-admin.js\ncommon-admin.js.map\n')
  })

  it('leaves the trigger alone when a rebuild changed nothing', () => {
    const cycle = setup()
    cycle({ 'common-admin.js': 'a' })
    writeFileSync(join(admin, '.common-admin-updated'), 'untouched')
    cycle({ 'common-admin.js': 'a' })
    expect(readFileSync(join(admin, '.common-admin-updated'), 'utf8')).toBe('untouched')
  })

  it('redoes a copy that failed, in full', () => {
    rmSync(join(library, 'src/vite'), { recursive: true })
    const cycle = setup()
    expect(() => cycle({ 'common-admin.js': 'a', 'components/AFoo.js': 'b' })).toThrow()
    write(join(library, 'src/vite/index.mjs'), '')
    cycle({ 'common-admin.js': 'a', 'components/AFoo.js': 'B' })
    expect(readFileSync(adminFile('common-admin.js'), 'utf8')).toBe('a')
    expect(readFileSync(adminFile('components/AFoo.js'), 'utf8')).toBe('B')
    expect(readFileSync(join(admin, '.common-admin-updated'), 'utf8')).toBe('*\n')
  })

  it('copies in full again when the package was replaced meanwhile (copy.sh, yarn install)', () => {
    const cycle = setup()
    cycle({ 'common-admin.js': 'a', 'components/AFoo.js': 'b' })
    rmSync(join(admin, PACKAGE, 'dist'), { recursive: true })
    write(adminFile('common-admin.js'), 'published')
    cycle({ 'common-admin.js': 'a', 'components/AFoo.js': 'B' })
    expect(readFileSync(adminFile('common-admin.js'), 'utf8')).toBe('a')
    expect(readFileSync(adminFile('components/AFoo.js'), 'utf8')).toBe('B')
    expect(readFileSync(join(admin, '.common-admin-updated'), 'utf8')).toBe('*\n')
  })

  it('never writes through a pnpm hard link into the store', () => {
    // pnpm: the package is a symlink into the virtual store, and every file there is a hard link to
    // the global content-addressable store -- written in place, it would change it for every project.
    const store = join(root, 'store')
    write(join(store, 'common-admin.js'), 'published')
    write(join(store, 'package.json'), '{"name":"@anzusystems/common-admin","version":"2.0.0"}')
    const virtual = join(
      admin,
      'node_modules/.pnpm/@anzusystems+common-admin@2.0.0/node_modules/@anzusystems/common-admin'
    )
    mkdirSync(join(virtual, 'dist'), { recursive: true })
    linkSync(join(store, 'common-admin.js'), join(virtual, 'dist/common-admin.js'))
    linkSync(join(store, 'package.json'), join(virtual, 'package.json'))
    mkdirSync(dirname(join(admin, PACKAGE)), { recursive: true })
    symlinkSync(virtual, join(admin, PACKAGE))

    const cycle = setup()
    cycle({ 'common-admin.js': 'dev build' })
    cycle({ 'common-admin.js': 'dev build 2' })

    expect(readFileSync(adminFile('common-admin.js'), 'utf8')).toBe('dev build 2')
    expect(readFileSync(join(store, 'common-admin.js'), 'utf8')).toBe('published')
    expect(readFileSync(join(store, 'package.json'), 'utf8')).toContain('2.0.0')
  })

  it('refuses a target that is not an admin', () => {
    vi.stubEnv('COMMON_ADMIN_TARGETS', join(root, 'nowhere'))
    const plugin = devCopyToAdmins()
    expect(() => (plugin.configResolved as (config: object) => void)({ root: library })).toThrow(/not an admin/)
  })
})
