/// <reference types="vitest" />
import { defineConfig } from 'vite'
import wasm from "vite-plugin-wasm"
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wasm()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: './setup-tests.js'
  }
})
