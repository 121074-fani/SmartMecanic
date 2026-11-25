import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { hubApi } from './server/hubApi';

/**
 * La app del técnico usa <script> clásicos (sin type="module") que Vite no empaqueta:
 * tras el build se copian sus archivos estáticos junto al HTML que sí procesa Vite.
 */
const copyTecnicosApp = (): Plugin => ({
  name: 'copy-tecnicos-del-manana',
  apply: 'build',
  closeBundle() {
    const src = resolve('tecnicos-del-manana');
    const out = resolve('dist/tecnicos-del-manana');
    for (const item of ['js', 'css', 'icons', 'manifest.json', 'sw.js']) {
      if (existsSync(`${src}/${item}`)) cpSync(`${src}/${item}`, `${out}/${item}`, { recursive: true });
    }
    // el manifest de la PWA usa rutas relativas (start_url, iconos): se apunta al original copiado
    const html = `${out}/index.html`;
    if (existsSync(html)) {
      writeFileSync(html, readFileSync(html, 'utf8').replace(/<link rel="manifest" href="[^"]*">/, '<link rel="manifest" href="manifest.json">'));
    }
  },
});

export default defineConfig(({ mode }) => {
  // ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY (+ *_MODEL) desde el entorno o .env.local
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // hubApi: backend local /api/* (módulos, telemetría, sesiones, extracción IA) → .data/hub.json + public/data/manuales
    plugins: [react(), hubApi({ env }), copyTecnicosApp()],
    server: { port: 5173, open: false },
    build: {
      rollupOptions: {
        // dashboard del supervisor (/) + app del técnico (/tecnicos-del-manana/)
        input: { main: 'index.html', tecnicos: 'tecnicos-del-manana/index.html' },
      },
    },
  };
});
