import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './setupTests.ts',
    // The backend has its own tests, run with node --test, and the end-to-end tests run with Playwright
    exclude: [...configDefaults.exclude, 'ecommerce-backend/**', 'e2e/**'],
  }
});