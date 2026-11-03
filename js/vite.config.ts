import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import config from './.generated/config.json' with { type: 'json' };
import { httpsRedirect } from './scripts/https-redirect';
import vue from '@vitejs/plugin-vue';
const redirectUri = (config as { oauthRedirectUri?: string }).oauthRedirectUri;
export const devHttps = redirectUri?.startsWith('https:') ?? false;
export default defineConfig({
  plugins: [
    vue(),
    ...(devHttps
      ? [basicSsl(), httpsRedirect(new URL(redirectUri!).origin)]
      : []),
  ],
  base: '/js/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    fs: { strict: true, allow: [import.meta.dirname] },
  },
  preview: { host: '0.0.0.0', port: 5173, strictPort: true },
});
