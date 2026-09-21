import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 4177,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: { main: 'index.html', equityVariants: 'equity-variants.html' },
    },
  },
})