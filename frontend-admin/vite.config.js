import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repo = process.env.GITHUB_REPOSITORY || 'genakulagin627-beep/corpseclient-website'
const pagesBase = process.env.PAGES_BASE || `/${repo.split('/')[1]}/admin/`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS === 'true' ? pagesBase : '/',
})
