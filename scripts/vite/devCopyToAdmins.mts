import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

const PACKAGE = 'node_modules/@anzusystems/common-admin'
const TRIGGER = '.common-admin-updated'
const MARKER = '.dev-admin'
// Shipped next to dist (package.json "files"); copied once when the watch starts.
const EXTRA_DIRS = ['src/eslint', 'src/vite']

/**
 * The admins to copy into: `COMMON_ADMIN_TARGETS` (colon separated), else whatever copy.sh would
 * take from `.env.local` / `.env` (ADMIN_PROJECT, colon separated or an array, and ADMIN_PROJECTS).
 */
function resolveTargets(root: string): string[] {
  const fromEnv = process.env.COMMON_ADMIN_TARGETS
  if (fromEnv !== undefined) return fromEnv.split(':').filter(Boolean)
  const script = `
    cd "$1"
    if [[ -f .env.local ]]; then source .env.local; elif [[ -f .env ]]; then source .env; fi
    T=()
    [[ -n "\${ADMIN_PROJECTS+x}" ]] && T+=("\${ADMIN_PROJECTS[@]}")
    if [[ -n "\${ADMIN_PROJECT+x}" ]]; then
      if [[ "$(declare -p ADMIN_PROJECT 2>/dev/null)" == "declare -a"* ]]; then T+=("\${ADMIN_PROJECT[@]}")
      else IFS=: read -r -a S <<< "\${ADMIN_PROJECT}"; T+=("\${S[@]}"); fi
    fi
    [[ \${#T[@]} -gt 0 ]] && printf '%s\\0' "\${T[@]}"
    true`
  return execFileSync('bash', ['-c', script, '_', root], { encoding: 'utf8' }).split('\0').filter(Boolean)
}

function walk(dir: string, base = dir, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, base, out)
    else out.push(path.relative(base, full))
  }
  return out
}

const isDeclaration = (file: string) => file.endsWith('.d.ts')

// A new file under the old name, never a write into the old one: under pnpm the old one is a hard link
// into the global store, shared by every project on that version. The rename also means the admin's
// dev server never reads a half-written file.
function copyFile(from: string, to: string) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  const temp = `${to}.${process.pid}.tmp`
  fs.copyFileSync(from, temp)
  fs.renameSync(temp, to)
}

/**
 * `vite build --watch` companion: after each rebuild copies the files whose content changed into
 * every admin's `node_modules/@anzusystems/common-admin/dist`, removes the ones the build no longer
 * emits, and writes their names into the admin's `.common-admin-updated` (`*` after a full copy),
 * which the admin's `commonAdminDevWatch()` reacts to.
 *
 * A full copy happens for an admin whenever its package does not hold this watch session's copy
 * (the first build, or `./copy.sh` or a reinstall replaced it meanwhile, which removes the marker
 * file). Bookkeeping advances only after a copy succeeded, so a failed one is simply redone.
 *
 * Declarations (`*.d.ts`) are never removed: the watch build does not generate them (only the
 * stylesheet's), so the admin keeps the ones from the last full `yarn build` + `./copy.sh`.
 */
export function devCopyToAdmins(): Plugin {
  // `COMMON_ADMIN_COPY=types` (`yarn dev:admin:types`): a full build that copies only the declarations,
  // next to a running `yarn dev:admin` (its own outDir) and without restarting the admin.
  const typesOnly = process.env.COMMON_ADMIN_COPY === 'types'
  let root = ''
  let targets: string[] = []
  // Content hashes of the last copy that went through, per admin.
  const copied = new Map<string, Map<string, string>>()
  // Written into each admin's dist by a full copy; its absence says the package was replaced.
  const session = `${process.pid}-${Date.now()}`
  let buildStartedAt = 0

  return {
    name: 'anzu:dev-copy-to-admins',
    apply: (config, env) => env.command === 'build' && (!!config.build?.watch || typesOnly),
    configResolved(config) {
      root = config.root
      targets = resolveTargets(root).map((target) => path.resolve(root, target))
      const missing = targets.filter((target) => !fs.existsSync(path.join(target, 'package.json')))
      if (targets.length === 0 || missing.length > 0) {
        throw new Error(
          `devCopyToAdmins: ${targets.length === 0 ? 'no target admin (COMMON_ADMIN_TARGETS, or ADMIN_PROJECT(S) in .env.local)' : `not an admin: ${missing.join(', ')}`}`
        )
      }
    },
    config: () => ({
      // The size report gzips all ~800 files and prints a line for each, on every rebuild.
      build: { reportCompressedSize: false },
    }),
    buildStart() {
      buildStartedAt = performance.now()
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      handler(outputOptions, bundle) {
        const start = performance.now()
        const outDir = outputOptions.dir ?? path.dirname(outputOptions.file ?? '')
        if (typesOnly) {
          for (const target of targets) {
            const dist = path.join(target, PACKAGE, 'dist')
            for (const file of walk(outDir).filter(isDeclaration)) copyFile(path.join(outDir, file), path.join(dist, file))
            // vue-tsc --build would call the admin up to date against the old declarations
            fs.rmSync(path.join(target, 'node_modules/.cache/tsc'), { recursive: true, force: true })
          }
          console.log(`[dev:admin:types] declarations copied to ${targets.length} admin(s)`)
          return
        }
        // Chunks, assets and their source maps (rolldown lists the maps too): whatever the build writes,
        // every rebuild, changed or not.
        const files = Object.keys(bundle)
        const current = new Map<string, string>()
        for (const file of files) {
          current.set(file, createHash('md5').update(fs.readFileSync(path.join(outDir, file))).digest('base64'))
        }

        let copiedCount = 0
        let fullCopies = 0
        for (const target of targets) {
          const pkg = path.join(target, PACKAGE)
          const dist = path.join(pkg, 'dist')
          const marker = path.join(dist, MARKER)
          const previous = copied.get(target)
          const full = !previous || !fs.existsSync(marker) || fs.readFileSync(marker, 'utf8') !== session
          const toCopy = full ? files : files.filter((file) => previous.get(file) !== current.get(file))
          const removed = full ? [] : [...previous.keys()].filter((file) => !current.has(file))

          if (full) {
            fullCopies++
            if (!fs.existsSync(path.join(dist, 'common-admin.d.ts'))) {
              this.warn(`${dist} has no declarations: run \`yarn build && ./copy.sh\` once for the types`)
            }
            // Files a previous build left behind (renamed or deleted modules), declarations excepted.
            const keep = new Set(files)
            if (fs.existsSync(dist)) {
              for (const file of walk(dist)) {
                if (!isDeclaration(file) && !keep.has(file)) fs.rmSync(path.join(dist, file), { force: true })
              }
            }
            copyFile(path.join(root, 'package.json'), path.join(pkg, 'package.json'))
            for (const dir of EXTRA_DIRS) {
              fs.rmSync(path.join(pkg, dir), { recursive: true, force: true })
              fs.cpSync(path.join(root, dir), path.join(pkg, dir), { recursive: true })
            }
          }
          for (const file of toCopy) copyFile(path.join(outDir, file), path.join(dist, file))
          for (const file of removed) fs.rmSync(path.join(dist, file), { force: true })
          if (full) fs.writeFileSync(marker, session)
          if (full || toCopy.length > 0 || removed.length > 0) {
            // What changed, for a watcher that wants to know; `*` after a full copy: everything.
            fs.writeFileSync(path.join(target, TRIGGER), full ? '*\n' : [...toCopy, ...removed].join('\n') + '\n')
          }
          // Only now: a copy that threw halfway is redone in full (or for the files it missed) next time.
          copied.set(target, current)
          copiedCount = Math.max(copiedCount, toCopy.length)
        }
        const now = performance.now()
        console.log(
          `[dev:admin] built in ${Math.round(start - buildStartedAt)} ms, copied ${copiedCount} file(s)${fullCopies ? ` (${fullCopies} full)` : ''} to ${targets.length} admin(s) in ${Math.round(now - start)} ms`
        )
      },
    },
  }
}
