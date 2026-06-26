import { getCollection, type CollectionEntry } from 'astro:content';
import { CERTS, type CertMeta } from '../config';
import {
  buildCertForest,
  flattenFiles,
  countFiles,
  type CertEntryLike,
  type CertTreeNode,
} from './cert-tree';

export type { CertTreeNode } from './cert-tree';

export interface Cert {
  slug: string;            // "cpts"
  meta: CertMeta;          // display metadata (falls back to upper-cased slug)
  tree: CertTreeNode[];    // navigation forest
  count: number;           // number of notes
}

/** Drafts (frontmatter draft:true) are hidden in production builds only. */
function isVisible(entry: CollectionEntry<'certs'>): boolean {
  return import.meta.env.PROD ? entry.data.draft !== true : true;
}

function metaFor(slug: string): CertMeta {
  return CERTS[slug] ?? { name: slug.toUpperCase() };
}

let _cache: Cert[] | null = null;

/** All certs, each with its built navigation tree, sorted by display name. */
export async function getCerts(): Promise<Cert[]> {
  if (_cache) return _cache;

  const entries = (await getCollection('certs')).filter(isVisible);
  const forest = buildCertForest(entries as CertEntryLike[]);

  const certs: Cert[] = [];
  for (const [slug, tree] of forest) {
    certs.push({ slug, meta: metaFor(slug), tree, count: countFiles(tree) });
  }
  certs.sort((a, b) => a.meta.name.localeCompare(b.meta.name, 'es'));

  _cache = certs;
  return certs;
}

export async function getCert(slug: string): Promise<Cert | undefined> {
  return (await getCerts()).find((c) => c.slug === slug);
}

/** Every note as a flat list of { cert, node } — drives the [...slug] route. */
export async function getAllCertNotes(): Promise<
  { cert: Cert; node: CertTreeNode }[]
> {
  const certs = await getCerts();
  return certs.flatMap((cert) =>
    flattenFiles(cert.tree).map((node) => ({ cert, node })),
  );
}
