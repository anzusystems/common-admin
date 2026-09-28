import { describeDeclaredDependencies } from '@/testing/declaredDependencies'
import packageJson from '../../package.json'

// The library's own sources: what it imports it declares, as the admins have to.
describeDeclaredDependencies({
  // The guard's own tests are made of import statements in strings.
  sources: import.meta.glob(['/src/**/*.{vue,ts,mts,scss}', '!/src/testing/__tests__/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  packageJson,
})
