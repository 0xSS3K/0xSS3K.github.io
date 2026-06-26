import { defineConfig } from 'astro/config';
import remarkObsidian from './src/lib/remark-obsidian.mjs';
import { buildObsidianMaps } from './src/lib/obsidian-links.ts';

// Build the title→slug and attachment maps once, then hand them to the remark
// plugin. The plugin runs over ALL markdown (posts + certs); posts use none of
// this syntax so it is a no-op there.
const obsidianMaps = buildObsidianMaps();

export default defineConfig({
  site: 'https://0xss3k.github.io',
  output: 'static',
  markdown: {
    remarkPlugins: [[remarkObsidian, obsidianMaps]],
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
