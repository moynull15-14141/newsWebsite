import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        host: true,
        proxy: {
            '/robots.txt': { target: 'http://localhost:3001', rewrite: function () { return '/api/v1/seo/robots.txt'; } },
            '/sitemap.xml': { target: 'http://localhost:3001', rewrite: function () { return '/api/v1/seo/sitemap.xml'; } },
            '/seo': { target: 'http://localhost:3001', rewrite: function (value) { return "/api/v1".concat(value); } },
        },
    },
});
