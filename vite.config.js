import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // zeigt dir die LAN-IP an, damit Handy testen geht
    proxy: {
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://localhost:8787', // dein vorhandener Mini-API-Server der App
        changeOrigin: true,
        secure: false
      },
      // nur falls dein Frontend direkt /optimize /save ohne VITE_OPTIMIZER_URL nutzt:
      '/optimize': { target: 'http://localhost:8001', changeOrigin: true, secure: false },
      '/save':     { target: 'http://localhost:8001', changeOrigin: true, secure: false },
    }
  }
})
