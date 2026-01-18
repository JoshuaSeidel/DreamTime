import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Run integration tests sequentially to avoid database conflicts
    fileParallelism: false,
    // Run tests in each file sequentially
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'dist', '**/*.d.ts'],
    },
    // Increase timeout for database operations
    testTimeout: 30000,
  },
});
