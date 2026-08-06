// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // IMPORTANT: replace with your real deployed domain before going live —
  // the sitemap integration needs this to generate correct absolute URLs.
  site: 'https://your-domain.example',
  integrations: [react(), sitemap()],

  vite: {
    plugins: [tailwindcss()]
  }
});