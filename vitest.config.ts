import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    env: {
      // Dummy value so modules that construct `new OpenAI()` at import time
      // (e.g. voice-entry-service.ts) don't throw during unrelated unit tests.
      OPENAI_API_KEY: 'test-key',
    },
  },
});
