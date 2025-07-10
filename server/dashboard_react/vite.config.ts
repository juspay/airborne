// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    plugins: [react()],
    base: '/dashboard/',
    ...(isDev && {
      server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        hmr: {
          protocol: 'ws',
          host: 'localhost',
          port: 5173,
        },
        watch: {
          usePolling: true,
        },
        proxy: {
          '/dashboard/configuration': {
            target: 'http://backend:9000',
            changeOrigin: false,
          },
          '/organisations': {
            target: 'http://backend:9000',
            changeOrigin: false,
          },
          '/organisation': {
            target: 'http://backend:9000',
            changeOrigin: false,
          },
          '/user': {
            target: 'http://backend:9000',
            changeOrigin: false,
          },
          '/users': {
            target: 'http://backend:9000',
            changeOrigin: false,
          },
          '/release': {
            target: 'http://backend:9000',
            changeOrigin: false,
          },
          '/analytics': {
            target: 'http://host.docker.internal:6400',
            changeOrigin: false,
          }
        },
      }
    })
  }
})
