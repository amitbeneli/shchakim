// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import preact from '@astrojs/preact';

// Production URL (sitemap, canonical and absolute OG image URLs)
export default defineConfig({
  site: 'https://shchakim-plum.vercel.app',
  trailingSlash: 'never',
  // 'class' makes the parent's scope class flow through the `class` prop into child components (Photo)
  scopedStyleStrategy: 'class',
  integrations: [sitemap({ filter: (page) => !page.includes('/thanks') }), preact()],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});