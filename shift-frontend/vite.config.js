import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Позволяет доступ по IP
    port: 5173,      // Порт (можете изменить если нужно)
    strictPort: true, // Не менять порт автоматически
  },
  preview: {
    host: '0.0.0.0', // Для production preview
    port: 5173,
  }
})