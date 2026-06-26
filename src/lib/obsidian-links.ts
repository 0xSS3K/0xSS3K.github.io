import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCertForest, flattenFiles } from './cert-tree';

// Build-time maps for the Obsidian remark plugin. Scanning the filesystem here
// (rather than the content collection) lets us build the title→slug map BEFORE
// content is loaded, so it can be handed to the remark plugin via astro.config.
// The slugs are produced by the SAME buildCertForest used for routing, so a
// resolved wikilink always points at a real /certs/<slug> page.

const NOTES_DIR = fileURLToPath(new URL('../../notas', import.meta.url));

const IMAGE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.bmp', '.ico',
]);

export interface ObsidianMaps {
  /** lowercased note basename → "/certs/<slug>" */
  links: Map<string, string>;
  /** lowercased attachment filename → absolute source path */
  attachments: Map<string, string>;
  /** URL prefix where copied attachments are served, e.g. "/certs-assets" */
  assetUrlBase: string;
  /** absolute output dir for copied attachments (under public/) */
  assetOutDir: string;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // notas/ missing → empty maps, never throw
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function buildObsidianMaps(): ObsidianMaps {
  const files = walk(NOTES_DIR);

  const mdIds = files
    .filter((f) => f.toLowerCase().endsWith('.md'))
    .map((f) => relative(NOTES_DIR, f).split(sep).join('/').replace(/\.md$/i, ''));

  const forest = buildCertForest(mdIds.map((id) => ({ id, data: {}, body: '' })));

  const links = new Map<string, string>();
  for (const tree of forest.values()) {
    for (const node of flattenFiles(tree)) {
      const id = node.entry?.id ?? '';
      const base = id.split('/').pop()?.toLowerCase();
      if (base && !links.has(base)) links.set(base, `/certs/${node.slug}`);
    }
  }

  const attachments = new Map<string, string>();
  for (const f of files) {
    if (IMAGE_EXT.has(extname(f).toLowerCase())) {
      const key = basename(f).toLowerCase();
      if (!attachments.has(key)) attachments.set(key, f);
    }
  }

  const assetOutDir = fileURLToPath(
    new URL('../../public/certs-assets', import.meta.url),
  );

  return { links, attachments, assetUrlBase: '/certs-assets', assetOutDir };
}
