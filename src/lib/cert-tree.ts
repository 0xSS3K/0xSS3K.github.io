import { slug as slugify } from 'github-slugger';

// Pure (Astro-free) tree builder shared by the runtime helper (src/lib/certs.ts)
// and the validation script (scripts/print-cert-tree.mjs). Keeping it free of
// `astro:content` imports lets us exercise it from plain Node.

/** Minimal shape we need from a collection entry. */
export interface CertEntryLike {
  id: string;
  body?: string;
  data?: {
    title?: string;
    tags?: string[];
    draft?: boolean;
    date?: Date;
  };
}

/**
 * A leading ATX H1 used as a title fallback — but ONLY when it is the very
 * first non-empty line of the note. These Obsidian notes overwhelmingly use
 * `#` for in-body section headings rather than a document title, so a mid-body
 * H1 must NOT hijack the title (the filename is the better label there).
 */
function leadingH1(body?: string): string | undefined {
  if (!body) return undefined;
  const firstLine = body.split('\n').find((l) => l.trim() !== '');
  if (!firstLine) return undefined;
  const m = firstLine.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/);
  return m ? m[1].trim() : undefined;
}

export interface CertTreeNode {
  type: 'folder' | 'file';
  /** Human label (emoji prefix stripped, numeric ordering prefix kept). */
  name: string;
  /** This segment's slug only, e.g. "01-recon-enum". */
  segment: string;
  /** Full slug path from the cert root, e.g. "cpts/01-recon-enum/dns-enum-53". */
  slug: string;
  /** Sort key: numeric prefix if present, else +Infinity (alphabetical). */
  order: number;
  /** Folders only. */
  children?: CertTreeNode[];
  /** Files only — the originating collection entry. */
  entry?: CertEntryLike;
}

/**
 * Strip a leading emoji / symbol / whitespace run while preserving any leading
 * digits. We can't lean on \p{Emoji} because the Unicode Emoji property also
 * matches the ASCII digits 0-9 — which are exactly the ordering prefixes we
 * want to keep. So we drop leading chars that are neither letters nor numbers.
 */
function cleanLabel(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/** Numeric ordering prefix (e.g. "00 Fundamentos" → 0); +Infinity if none. */
function orderOf(label: string): number {
  const m = cleanLabel(label).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

function sortNodes(a: CertTreeNode, b: CertTreeNode): number {
  // Folders before files at the same level, then numeric prefix, then name.
  if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
  if (a.order !== b.order) return a.order - b.order;
  return a.name.localeCompare(b.name, 'es');
}

/** Disambiguate sibling slugs deterministically (append -2, -3, …). */
function uniqueSegment(base: string, taken: Set<string>): string {
  let candidate = base || 'untitled';
  let n = 2;
  while (taken.has(candidate)) candidate = `${base || 'untitled'}-${n++}`;
  taken.add(candidate);
  return candidate;
}

interface InternalFolder extends CertTreeNode {
  type: 'folder';
  children: CertTreeNode[];
  _byName: Map<string, InternalFolder>;
  _slugs: Set<string>;
}

function newFolder(name: string, segment: string, slug: string): InternalFolder {
  return {
    type: 'folder',
    name,
    segment,
    slug,
    order: orderOf(name),
    children: [],
    _byName: new Map(),
    _slugs: new Set(),
  };
}

/**
 * Build the per-cert navigation forest from a flat list of entries. The entry
 * id is a POSIX path whose first segment is the cert slug source.
 * Returns a map of certSlug → root folder nodes (children of the cert).
 */
export function buildCertForest(entries: CertEntryLike[]): Map<string, CertTreeNode[]> {
  // certSlug → synthetic root folder holding that cert's tree.
  const roots = new Map<string, InternalFolder>();

  for (const entry of entries) {
    const parts = entry.id.split('/').filter(Boolean);
    if (parts.length < 2) continue; // need at least "<cert>/<file>"

    const certSegment = slugify(cleanLabel(parts[0])) || 'cert';
    let root = roots.get(certSegment);
    if (!root) {
      root = newFolder(cleanLabel(parts[0]), certSegment, certSegment);
      roots.set(certSegment, root);
    }

    let cursor: InternalFolder = root;
    // Walk intermediate folders (everything between cert and the file).
    for (let i = 1; i < parts.length - 1; i++) {
      const rawName = parts[i];
      const label = cleanLabel(rawName);
      let child = cursor._byName.get(label);
      if (!child) {
        const seg = uniqueSegment(slugify(label), cursor._slugs);
        child = newFolder(label, seg, `${cursor.slug}/${seg}`);
        cursor._byName.set(label, child);
        cursor.children.push(child);
      }
      cursor = child;
    }

    // The file leaf. Title precedence: frontmatter → first H1 → filename.
    const rawFile = parts[parts.length - 1];
    const label = cleanLabel(rawFile);
    const title = entry.data?.title?.trim() || leadingH1(entry.body) || label;
    const seg = uniqueSegment(slugify(label), cursor._slugs);
    cursor.children.push({
      type: 'file',
      name: title,
      segment: seg,
      slug: `${cursor.slug}/${seg}`,
      order: orderOf(rawFile),
      entry,
    });
  }

  // Recursively sort and shed the internal bookkeeping fields.
  function finalize(node: CertTreeNode): CertTreeNode {
    if (node.children) {
      node.children = node.children.map(finalize).sort(sortNodes);
      const f = node as InternalFolder;
      delete (f as Partial<InternalFolder>)._byName;
      delete (f as Partial<InternalFolder>)._slugs;
    }
    return node;
  }

  const out = new Map<string, CertTreeNode[]>();
  for (const [certSlug, root] of roots) {
    finalize(root);
    out.set(certSlug, root.children);
  }
  return out;
}

/** Flatten a forest to its file leaves (depth-first, in display order). */
export function flattenFiles(nodes: CertTreeNode[]): CertTreeNode[] {
  const out: CertTreeNode[] = [];
  for (const n of nodes) {
    if (n.type === 'file') out.push(n);
    else if (n.children) out.push(...flattenFiles(n.children));
  }
  return out;
}

/** Count file leaves in a forest. */
export function countFiles(nodes: CertTreeNode[]): number {
  return flattenFiles(nodes).length;
}
