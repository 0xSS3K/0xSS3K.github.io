// Validation helper for SUBFASE 1: walks notas/ exactly like the Astro glob
// loader (id = path relative to ./notas, POSIX, no extension), feeds those ids
// to the SAME pure tree builder the site uses, and prints the resulting tree.
//
// Usage:  node scripts/print-cert-tree.mjs [certSlug]   (default: cpts)
import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCertForest, countFiles } from '../src/lib/cert-tree.ts';

const ROOT = fileURLToPath(new URL('../notas', import.meta.url));
const target = process.argv[2] ?? 'cpts';

async function walk(dir) {
  const out = [];
  for (const dirent of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, dirent.name);
    if (dirent.isDirectory()) out.push(...(await walk(full)));
    else if (dirent.isFile() && dirent.name.toLowerCase().endsWith('.md')) {
      const id = relative(ROOT, full).split(sep).join('/').replace(/\.md$/i, '');
      out.push({ id, data: {} });
    }
  }
  return out;
}

const entries = await walk(ROOT);
const forest = buildCertForest(entries);
const tree = forest.get(target);

if (!tree) {
  console.error(`No cert "${target}". Available: ${[...forest.keys()].join(', ')}`);
  process.exit(1);
}

function render(nodes, prefix = '') {
  nodes.forEach((n, i) => {
    const last = i === nodes.length - 1;
    const branch = last ? '└─ ' : '├─ ';
    const marker = n.type === 'folder' ? '▸' : ' ';
    const ord = Number.isFinite(n.order) ? String(n.order).padStart(2, '0') : '--';
    console.log(`${prefix}${branch}${marker} [${ord}] ${n.name}   ⟶  ${n.slug}`);
    if (n.children) render(n.children, prefix + (last ? '   ' : '│  '));
  });
}

console.log(`\nCERT: ${target}   (${countFiles(tree)} notas, ${entries.length} total en notas/)\n`);
render(tree);
console.log('');
