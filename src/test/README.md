# Testing Setup

This project uses Vitest for testing Vue components with Vuetify support.

## Features

- **Vitest**: Fast unit test runner with native ES modules support
- **Happy-dom**: Lightweight DOM environment for fast testing
- **Browser Testing**: Optional browser testing with Playwright and Chromium
- **Vue Test Utils**: Official testing utilities for Vue components
- **Vuetify Support**: Proper mocking and stubbing for Vuetify components

## Running Tests

### Basic Testing (Happy-dom)
```bash
# Run tests in watch mode
yarn test

# Run tests once
yarn test:run

# Run tests with UI
yarn test:ui
```

### Browser Testing (Chromium)
```bash
# Run tests in browser (watch mode)
yarn test:browser

# Run tests in browser once
yarn test:browser:run
```

### Coverage
```bash
# Run tests with coverage
yarn test:coverage
```

## Test Structure

- `src/test/setup.ts` - Global test setup with Vuetify, i18n, and Pinia configuration
- `src/test/components/` - Component tests
- `vitest.config.ts` - Vitest configuration

## Writing Tests

### Component Testing Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

The setup automatically mocks:
- CSS imports
- Vuetify components (when needed)
- Browser APIs (ResizeObserver, IntersectionObserver, matchMedia)

### Best Practices

1. **Focus on behavior**: Test what the component does, not how it does it
2. **Use proper selectors**: Prefer data-testid or semantic selectors over CSS classes
3. **Mock external dependencies**: Use vi.mock() for external services
4. **Test error states**: Include tests for error conditions and edge cases
5. **Keep tests simple**: One assertion per test when possible

## Configuration

The test setup includes:
- Global Vuetify instance with all components
- i18n configuration with basic translations
- Pinia store setup
- Automatic CSS mocking
- Browser API mocks

## Browser Testing

Browser testing is available for integration tests that need real browser behavior:
- Uses Playwright with Chromium
- Runs headless in CI, headed in development
- Enable with `VITEST_BROWSER=true` environment variable
