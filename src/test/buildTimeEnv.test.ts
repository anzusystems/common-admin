import { describe, expect, it } from 'vitest'

// The library's build replaces `import.meta.env.*`, so in `dist` it says what the library was built with,
// never what the admin runs: `import.meta.env.DEV` is `false` there even in an admin's development. Tests
// cannot see that (they run the sources, where it is `true`). `isDevelopment()` asks the admin's build.
const sources = import.meta.glob(
  ['/src/**/*.{ts,vue}', '!/src/**/__tests__/**', '!/src/test/**', '!/src/playground/**'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  }
) as Record<string, string>

describe('the library sources', () => {
  it('do not read import.meta.env, which the build fixes', () => {
    const readers = Object.entries(sources)
      .filter(([, source]) => /import\.meta\.env\b/.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))
      .map(([path]) => path)
    expect(readers).toEqual([])
  })
})
