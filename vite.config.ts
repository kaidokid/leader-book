import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// 纯前端版本：无后端，直接构建静态产物
// 已移除 trae-solo-badge 插件（面向大领导场景，不显示右下角弹窗）
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  // pdfjs-dist worker 配置
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdfjs': ['pdfjs-dist'],
          'mermaid': ['mermaid'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'markdown': ['react-markdown', 'remark-gfm', 'rehype-raw'],
        },
      },
    },
  },
})
