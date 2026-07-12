import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3') || id.includes('lodash') || id.includes('react-resize-detector')) {
              return 'vendor-charts';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
