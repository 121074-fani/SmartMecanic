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

/** Dominios de ngrok (plan gratuito y de pago) permitidos para abrir un túnel al servidor de Vite. */
const TUNNEL_HOSTS = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'];

export default defineConfig(({ mode }) => {
  // ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY (+ *_MODEL) desde el entorno o .env.local
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // hubApi: backend local /api/* (módulos, telemetría, sesiones, extracción IA) → .data/hub.json + public/data/manuales
    plugins: [react(), hubApi({ env }), copyTecnicosApp()],
    // Túneles (ngrok): Vite bloquea hosts externos por seguridad; se permiten solo los dominios de ngrok.
    // El punto inicial permite cualquier subdominio (p. ej. abc123.ngrok-free.app).
    server: { port: 5173, open: false, allowedHosts: TUNNEL_HOSTS },
    preview: { allowedHosts: TUNNEL_HOSTS },
    build: {
      rollupOptions: {
        // dashboard del supervisor (/) + app del técnico (/tecnicos-del-manana/)
        input: { main: 'index.html', tecnicos: 'tecnicos-del-manana/index.html' },
      },
    },
  };
});
