import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    env: { VITE_LOG_LEVEL: 'silent', VITE_API_BASE_URL: '/api/v1' },
    // e2e/ holds Playwright specs (run via `npx playwright test`), not
    // Vitest ones — without this Vitest tries to run them too and fails
    // on the unrelated @playwright/test APIs.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
    },
  },
})
