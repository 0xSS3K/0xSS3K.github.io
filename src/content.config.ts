import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title:       z.string(),
    date:        z.coerce.date(),
    description: z.string().optional(),
    tags:        z.array(z.string()).optional().default([]),
    draft:       z.boolean().optional().default(false),
  }),
});

// ─── certs ────────────────────────────────────────────────────────────────
// Notes imported from Obsidian. The schema is intentionally TOLERANT: every
// field is optional and malformed frontmatter is coerced/caught instead of
// throwing, so an irregular note can never break the production build.
//   - `title` may be absent (we derive it from the H1 or filename downstream).
//   - `tags` accepts a bare string OR a string[]; both normalize to string[].
//   - The entry `id` is the raw path relative to ./notas (extension stripped),
//     e.g. "cpts/📁 01 Recon&Enum/.../DNS Enum (53)". The first segment is the
//     cert. src/lib/certs.ts turns these ids into the slugged navigation tree.
const certs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './notas',
    generateId: ({ entry }) => entry.replace(/\.md$/i, ''),
  }),
  schema: z.object({
    title:       z.string().optional(),
    date:        z.coerce.date().optional().catch(undefined),
    description: z.string().optional().catch(undefined),
    tags: z
      .preprocess(
        (v) => (v == null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]),
        z.array(z.string()),
      )
      .catch([]),
    draft:       z.boolean().optional().default(false).catch(false),
  }),
});

export const collections = { posts, certs };
