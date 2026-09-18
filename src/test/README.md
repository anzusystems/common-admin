# Testing Setup

This project uses Vitest for testing Vue components with Vuetify support.

## Features

- **Vitest**: Fast unit test runner with native ES modules support
- **Browser Mode**: Tests run in real Chromium via Playwright (`test.browser.enabled`)
- **Vue Test Utils**: Official testing utilities for Vue components
- **Vuetify Support**: Real Vuetify instance with all standard components, directives and styles

## Running Tests

```bash
# Run tests in watch mode (runs once under CI)
yarn test

# Run tests once
yarn test:run

# Run tests with UI
yarn test:ui
```

All three run in Chromium; there is no separate happy-dom mode. Coverage is not configured.

Since Vitest 5 the UI is token-authenticated. `yarn test:ui` opens the browser and carries the
token; the cookie persists, so a bookmark works until you clear cookies.

## Test Structure

- `src/test/setup.ts` - Global test setup with Vuetify, i18n, and Pinia configuration
- `src/test/components/` - Component tests
- `src/test/composables/` - Composable and utility tests
- `vitest.config.mts` - Vitest configuration

## Writing Tests

### Component Testing Example

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import YourComponent from '@/path/to/YourComponent.vue'

describe('YourComponent', () => {
  it('renders correctly', () => {
    const wrapper = mount(YourComponent, {
      props: {
        // your props
      },
      global: {
        provide: {
          // any injections needed
        },
        stubs: {
          // stub child components if needed
        },
      },
    })

    expect(wrapper.find('.some-element').exists()).toBe(true)
  })
})
```

### Mocking

`setup.ts` replaces `window.matchMedia` with a stub that answers `(any-pointer: fine)` truthfully,
so the suite looks like a desktop with a mouse. Override it per-test for touch-only behaviour.

It does **not** mock CSS or Vuetify — browser mode loads the real styles and components.
`ResizeObserver` and `IntersectionObserver` are polyfilled only if missing, which Chromium never is.

`clearMocks: true` clears mock call history before every test and every retry. Implementations
survive — only `mockReset()` clears those — so tests need no `vi.clearAllMocks()` of their own.

### Best Practices

1. **Focus on behavior**: Test what the component does, not how it does it
2. **Use proper selectors**: CSS class is fine for stable markup; prefer `data-testid` where a
   selector would otherwise depend on styling
3. **Mock external dependencies**: Use vi.mock() for external services
4. **Test error states**: Include tests for error conditions and edge cases
5. **Keep tests simple**: One assertion per test when possible

## Configuration

The test setup includes:

- Global Vuetify instance with all standard components, directives and real styles
  (Labs components are not registered; import them from `vuetify/labs/components`)
- i18n configured with the full English locale messages from `@/locales/en`
- Pinia store setup
- A `window.matchMedia` stub (see Mocking above)
- `retry`: 1 locally, 2 in CI — a flaky test that passes on a later attempt still reports green
- 30 s `testTimeout` / `hookTimeout`, and `globals: true` (so `describe`/`it`/`expect` work unimported)

Vitest 5 writes artifacts under `.vitest/` (failure screenshots in
`.vitest/attachments/failure-screenshots/`); it is gitignored. `-t` now joins names with `' > '`.

## Browser Testing

The whole suite runs in a real browser:

- Uses Playwright with Chromium
- Runs headless by default, everywhere
- Set `VITEST_HEADED=1` to watch the browser instead of running headless
