import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Explicit imports preferred for clarity
    globals: false,

    // Node.js environment (not jsdom - this is a CLI tool)
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.js',
        '**/*.config.js',
        'test/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 79,
        statements: 80
      }
    },

    // Global test setup with fetch mocking
    setupFiles: ['./test/setup.js'],

    // Colocated tests in src/
    include: ['src/**/*.test.js']
  }
});
