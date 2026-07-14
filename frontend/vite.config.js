import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), 
    tailwindcss()
  ],
  server: {
    allowedHosts: ['797cf1b075ca.ngrok-free.app'], // ✅ Add your ngrok domain here
  }
})
