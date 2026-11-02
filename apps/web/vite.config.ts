// إعداد Vite: واجهة React، تطبيق PWA يعمل دون اتصال، واختبارات Vitest
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        id: '/',
        name: 'مدرستي - غيث',
        short_name: 'مدرستي',
        description: 'منصة تعليمية تعمل دون اتصال لرياضيات الصف الثاني',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#f6f3ea',
        theme_color: '#2f6f8f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // كل ملفات التطبيق تُخزَّن مسبقًا؛ حزم المحتوى الكبيرة تُدار يدويًا لاحقًا عبر Cache Storage
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,mp3,ogg}'],
        navigateFallback: '/index.html',
        // لا تُخزَّن صفحة لوحة الأب الحساسة بشكل مختلف؛ الكل محلي
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
