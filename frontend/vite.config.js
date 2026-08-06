import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), 
    tailwindcss()
  ],
  server: {
    allowedHosts: ['797cf1b075ca.ngrok-free.app'], // ✅ Add your ngrok domain here
    fs: {
      // The document templates live in ../shared so the backend PDF generator
      // and this app render from one source; allow the dev server to read it.
      allow: ['..'],
    },
  }
})
