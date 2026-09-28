import { describe, expect, it } from 'vitest'
import en from '@/locales/en'
import sk from '@/locales/sk'
import cs from '@/locales/cs'

// The unplugin precompiles the locale json as the library build does, so a leaf is a message AST
// (`{ type, body, … }`) rather than a string.
// Every literal message key the library hands to vue-i18n has to exist in the messages it ships.
// A key that does not resolves to itself, so the user reads "damImage.queueItem.x" in an alert.
const sources = import.meta.glob(
  ['/src/**/*.{ts,vue}', '!/src/test/**', '!/src/**/__tests__/**', '!/src/playground/**', '!/src/**/*.d.ts'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
) as Record<string, string>

// Keys owned by the host admin, not the library (vue-i18n's `missing` handler skips them too).
const HOST_KEY_PREFIXES = ['system.subject.']

const PATTERNS: RegExp[] = [
  // t('k'), $t('k'), commonT('k'), i18n.global.t('k'), show{Error,Success,Info,Warning}T('k')
  /(?<![\w.$])(?:\$?t|commonT|i18n\.global\.t|show(?:Error|Success|Info|Warning)T)\(\s*(['"`])([^'"`$\n]+)\1\s*([,)+])/g,
  // object/prop literals: titleT: 'k', buttonT: 'k' (a string literal only)
  /\b[a-z]\w*T\??\s*:\s*(['"])([a-z$][\w$]*(?:\.[\w$]+)+)\1\s*([,}\n])/g,
  // template attributes: title-t="k", :title-t="'k'"
  /\s[a-z][\w-]*-t="(')?([a-z$][\w$]*(?:\.[\w$]+)+)\1?"()/g,
]

const isMessage = (leaf: unknown) =>
  typeof leaf === 'string' ||
  typeof leaf === 'function' ||
  (typeof leaf === 'object' && leaf !== null && typeof (leaf as { type?: unknown }).type === 'number' && 'body' in leaf)

const lookup = (messages: unknown, key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as any)[part] : undefined), messages)

const collect = () => {
  const found: { file: string; line: number; key: string }[] = []
  for (const [file, code] of Object.entries(sources)) {
    for (const pattern of PATTERNS) {
      for (const match of code.matchAll(pattern)) {
        const key = match[2]
        if (match[3] === '+' || key.endsWith('.')) continue // concatenated, dynamic
        if (HOST_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) continue
        found.push({ file, line: code.slice(0, match.index).split('\n').length, key })
      }
    }
  }
  return found
}

describe('literal i18n keys', () => {
  it('exist in en, sk and cs', () => {
    const found = collect()
    expect(found.length).toBeGreaterThan(300)
    const missing = found.flatMap(({ file, line, key }) =>
      (['en', 'sk', 'cs'] as const)
        .filter((locale) => !isMessage(lookup({ en, sk, cs }[locale], key)))
        .map((locale) => `${locale} ${file}:${line} ${key}`)
    )
    expect(missing).toEqual([])
  })

  it('alerts are not raw literals', () => {
    const literal = /(?<![\w.$])show(?:Error|Success|Info|Warning)\(\s*(['"`])/g
    const offenders = Object.entries(sources).flatMap(([file, code]) =>
      [...code.matchAll(literal)].map((m) => `${file}:${code.slice(0, m.index).split('\n').length}`)
    )
    expect(offenders).toEqual([])
  })

  // The upload queue shows `item.error.message` as it is (UploadQueueItemEditable, UploadQueueDialogSingle).
  it('upload queue item error messages are not raw literals', () => {
    const literal = /\.error\.message\s*=\s*(['"`])/g
    const offenders = Object.entries(sources).flatMap(([file, code]) =>
      [...code.matchAll(literal)].map((m) => `${file}:${code.slice(0, m.index).split('\n').length}`)
    )
    expect(offenders).toEqual([])
  })
})
