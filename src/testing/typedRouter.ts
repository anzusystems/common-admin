/** What the guard tests read out of an admin's generated `src/typed-router.d.ts`. */
export interface TypedRouterDeclaration {
  /** Every declared route name, in declaration order. */
  names: string[]
  /** Every declared route with its path pattern, the catch-all included. */
  paths: Array<{ name: string; path: string }>
  /** The route names each page file defines; a page that defines none is left out. */
  pageRoutes: Map<string, string[]>
}

export function parseTypedRouterDeclaration(declaration: string): TypedRouterDeclaration {
  const names = [...declaration.matchAll(/^ {4}'([^']+)': RouteRecordInfo</gm)].map(([, name]) => name!)

  // The declaration holds TypeScript source, so a `\d` constraint is written there as an escaped
  // backslash. Reading it raw would leave `\\d`, which matches a literal backslash and nothing else.
  const paths = [...declaration.matchAll(/'[^']+':\s*RouteRecordInfo<\s*'([^']*)',\s*'([^']+)'/g)].map(
    ([, name, path]) => ({ name: name!, path: path!.replace(/\\\\/g, '\\') })
  )

  // The declaration lists a `never` for pages that define no route; those blocks carry no quoted
  // name and simply do not match.
  const pageRoutes = new Map(
    [...declaration.matchAll(/'(src\/pages\/[^']+)':\s*\{\s*routes:((?:\s*\|\s*'[^']*')+)/g)].map(([, file, block]) => [
      file!,
      [...block!.matchAll(/'([^']*)'/g)].map(([, name]) => name!),
    ])
  )

  return { names, paths, pageRoutes }
}

/**
 * `src/…` for a key of `import.meta.glob`: `../pages/x.vue` from a test in `src/test/`, or
 * `/src/pages/x.vue` from an absolute glob.
 */
export const globKeyToSrcPath = (key: string) => key.replace(/^\/src\//, 'src/').replace(/^\.\.\//, 'src/')
