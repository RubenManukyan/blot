import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const isGithubPages = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  base: isGithubPages ? '/blot/' : '/',
  plugins: [react()],
})
