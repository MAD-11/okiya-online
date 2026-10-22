import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'offline.html'],
      manifest: {
        name: 'Окийя',
        short_name: 'Окийя',
        description: 'Онлайн версия настольной игры Окийя',
        theme_color: '#0f0f14',
        background_color: '#0f0f14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/, /^\/health/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Socket.IO — всегда сеть, никогда кэш
            urlPattern: /^https?:\/\/.*\/socket\.io/,
            handler: 'NetworkOnly',
          },
          {
            // Health check — сеть
            urlPattern: /\/health$/,
            handler: 'NetworkOnly',
          },
          {
            // Шрифты — кэш навсегда
            urlPattern: /\.(?:woff2|woff|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
});