import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, type PluginOption } from 'vite'

export const LIBRARY_SOURCE = `export function explode(reason: string): never {
  throw new Error('library failure: ' + reason)
}
`

/**
 * A throwaway project outside the repository: a fake `@anzusystems/common-admin` in its
 * node_modules, built by Vite in lib mode with source maps like the real one, and an app entry
 * importing it.
 */
export async function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'anzu-vite-'))
  const libRoot = join(root, 'library')
  mkdirSync(join(libRoot, 'src'), { recursive: true })
  writeFileSync(join(libRoot, 'src/explode.ts'), LIBRARY_SOURCE)
  const packageDir = join(root, 'node_modules/@anzusystems/common-admin')
  mkdirSync(packageDir, { recursive: true })
  writeFileSync(
    join(packageDir, 'package.json'),
    JSON.stringify({ name: '@anzusystems/common-admin', type: 'module', module: './dist/common-admin.js' })
  )
  await build({
    root: libRoot,
    logLevel: 'silent',
    configFile: false,
    build: {
      outDir: join(packageDir, 'dist'),
      sourcemap: true,
      lib: { entry: join(libRoot, 'src/explode.ts'), formats: ['es'], fileName: () => 'common-admin.js' },
    },
  })
  writeFileSync(
    join(root, 'main.js'),
    "import { explode } from '@anzusystems/common-admin'\nwindow.onclick = () => explode('click')\n"
  )

  return {
    root,
    async buildApp(plugins: PluginOption[], options: { outDir?: string; sourcemap?: boolean | 'hidden' } = {}) {
      const outDir = join(root, options.outDir ?? 'dist')
      await build({
        root,
        logLevel: 'silent',
        configFile: false,
        plugins,
        build: {
          outDir,
          emptyOutDir: true,
          sourcemap: options.sourcemap,
          rolldownOptions: { input: join(root, 'main.js') },
        },
      })
      return outDir
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true })
    },
  }
}

export function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
}

/** Copies `src/vite` somewhere `@sentry/vite-plugin` cannot be resolved from. */
export function copyViteEntryOutsideRepository(): string {
  const dir = mkdtempSync(join(tmpdir(), 'anzu-vite-nopeer-'))
  cpSync(join(import.meta.dirname, '../../vite'), dir, { recursive: true })
  return dir
}
