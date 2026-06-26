import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { slug as ghSlug } from 'github-slugger';

/**
 * remarkObsidian — translate the bits of Obsidian-flavoured markdown we use:
 *
 *   [[Note]] · [[Note|alias]] · [[Note#heading]]   → internal <a> links
 *   ![[image.png]]                                  → <img> (asset copied to public/)
 *   > [!type] Title …                               → styled callout <div>
 *
 * Design guarantees:
 *   - Operates on the mdast, so anything inside fenced/inline CODE is untouched
 *     (the current notes only contain `[[`, `[!]` inside shell/C snippets).
 *   - A wikilink whose target can't be resolved degrades to PLAIN TEXT — it
 *     never throws and never fails the build.
 *   - No new dependencies: Node built-ins + github-slugger (already a dep).
 *
 * Receives the prebuilt maps (see src/lib/obsidian-links.ts) as its options.
 */
export default function remarkObsidian(maps = {}) {
  const { links, attachments, assetUrlBase = '/certs-assets', assetOutDir } = maps;
  const copied = new Set();

  // [[...]] or ![[...]] — non-greedy, single line.
  const WIKILINK_RE = /(!?)\[\[([^\]\n]+?)\]\]/g;

  function resolveLink(target) {
    if (!links || !target) return null;
    const base = target.split('/').pop().trim().toLowerCase();
    return links.get(base) ?? links.get(target.trim().toLowerCase()) ?? null;
  }

  function resolveAttachment(target) {
    if (!attachments || !assetOutDir) return null;
    const key = target.split('/').pop().trim().toLowerCase();
    const src = attachments.get(key);
    if (!src) return null;
    const fname = src.split(/[\\/]/).pop();
    if (!copied.has(fname)) {
      try {
        if (!existsSync(assetOutDir)) mkdirSync(assetOutDir, { recursive: true });
        copyFileSync(src, join(assetOutDir, fname));
      } catch {
        /* copy best-effort: a missing asset must not break the build */
      }
      copied.add(fname);
    }
    return `${assetUrlBase}/${encodeURIComponent(fname)}`;
  }

  // Parse "target#heading|alias" into its parts.
  function parseTarget(inner) {
    let rest = inner.trim();
    let alias = null;
    const pipe = rest.indexOf('|');
    if (pipe !== -1) {
      alias = rest.slice(pipe + 1).trim();
      rest = rest.slice(0, pipe).trim();
    }
    let heading = null;
    const hash = rest.indexOf('#');
    if (hash !== -1) {
      heading = rest.slice(hash + 1).trim();
      rest = rest.slice(0, hash).trim();
    }
    return { target: rest, heading, alias };
  }

  // Expand one text node's string into a list of mdast inline nodes.
  function expandText(value) {
    const nodes = [];
    let last = 0;
    let m;
    WIKILINK_RE.lastIndex = 0;
    while ((m = WIKILINK_RE.exec(value))) {
      const [full, bang, inner] = m;
      if (m.index > last) {
        nodes.push({ type: 'text', value: value.slice(last, m.index) });
      }
      last = m.index + full.length;

      const { target, heading, alias } = parseTarget(inner);

      if (bang === '!') {
        // Embed: image attachment → <img>; otherwise fall back to a link/text.
        const asset = resolveAttachment(target);
        if (asset) {
          nodes.push({ type: 'image', url: asset, alt: alias || target, title: null });
          continue;
        }
        const url = resolveLink(target);
        if (url) {
          nodes.push(linkNode(url, heading, alias || target));
        } else {
          nodes.push({ type: 'text', value: full }); // leave unknown embed literal
        }
        continue;
      }

      // Plain wikilink.
      const url = resolveLink(target);
      const display = alias || target || heading || '';
      if (url) {
        nodes.push(linkNode(url, heading, display));
      } else {
        nodes.push({ type: 'text', value: display }); // broken link → plain text
      }
    }
    if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) });
    return nodes;
  }

  function linkNode(url, heading, text) {
    return {
      type: 'link',
      url: heading ? `${url}#${ghSlug(heading)}` : url,
      data: { hProperties: { className: ['wikilink'] } },
      children: [{ type: 'text', value: text }],
    };
  }

  // > [!type] Title  →  <div class="callout callout-type"> … </div>
  function transformCallout(blockquote) {
    const first = blockquote.children?.[0];
    if (first?.type !== 'paragraph' || !first.children?.length) return false;
    const head = first.children[0];
    if (head?.type !== 'text') return false;
    const cm = head.value.match(/^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)/);
    if (!cm) return false;

    const type = cm[1].toLowerCase();
    const titleText = cm[3].trim();

    // Drop the marker line from the body paragraph.
    const nl = head.value.indexOf('\n');
    if (nl === -1) {
      first.children.shift();
      if (first.children.length === 0) blockquote.children.shift();
    } else {
      head.value = head.value.slice(nl + 1);
    }

    const titleNode = {
      type: 'paragraph',
      data: { hProperties: { className: ['callout-title'] } },
      children: [{ type: 'text', value: titleText || type.toUpperCase() }],
    };
    blockquote.children.unshift(titleNode);

    blockquote.data = blockquote.data || {};
    blockquote.data.hName = 'div';
    blockquote.data.hProperties = {
      className: ['callout', `callout-${type}`],
      'data-callout': type,
    };
    return true;
  }

  function walk(node) {
    if (!node || !Array.isArray(node.children)) return;

    const out = [];
    for (const child of node.children) {
      if (child.type === 'blockquote') {
        transformCallout(child);
        out.push(child);
        walk(child);
      } else if (child.type === 'text' && child.value.includes('[[')) {
        out.push(...expandText(child.value));
      } else {
        out.push(child);
        walk(child); // code / inlineCode have no children → naturally skipped
      }
    }
    node.children = out;
  }

  return (tree) => walk(tree);
}
