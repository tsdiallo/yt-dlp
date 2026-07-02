import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// le proxy sert uniquement pour `npm run dev` ; en production FastAPI sert dist/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
