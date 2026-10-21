// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// TODO: update `site` once the Vercel URL is final (used for sitemap + OG absolute URLs)
export default defineConfig({
  site: 'https://shchakim.vercel.app',
  trailingSlash: 'never',
  // 'class' makes the parent's scope class flow through the `class` prop into child components (Photo)
  scopedStyleStrategy: 'class',
  integrations: [sitemap({ filter: (page) => !page.includes('/thanks') })],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
