import { defineConfig } from 'vite';

// Tauri 데스크톱 위젯 프론트엔드 빌드 설정.
// 1420 고정 포트로 dev 서버를 띄워 `tauri dev`가 붙는다.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Rust 빌드 산출물은 HMR 감시에서 제외.
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    // 시스템 웹뷰(macOS WKWebView) 타깃 — 최신 ES 사용.
    target: 'esnext',
    sourcemap: false,
  },
});
