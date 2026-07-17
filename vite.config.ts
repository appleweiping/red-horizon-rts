import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // integration tests step full worlds for thousands of ticks; give slow
    // machines and cold CI runners generous headroom
    testTimeout: 60000,
  },
} as Parameters<typeof defineConfig>[0]);
