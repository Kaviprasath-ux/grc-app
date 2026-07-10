import type { CharterBlock, CharterInlineNode, CharterListItem, CharterRow } from './charter-parser';

/**
 * Returns true for strings that should not be sent to the translation API:
 * - No letters/digits at all (underscores, dashes, spaces)
 * - Fewer than 4 letters total (e.g. "'s:", "'s" grammatical fragments)
 */
function isUntranslatable(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  return letters.length < 4;
}

/**
 * Collect all unique non-empty text strings from `text` nodes in the blocks.
 * Field nodes and non-letter strings (signature lines, underscores, etc.) are skipped.
 */
export function extractTexts(blocks: CharterBlock[]): string[] {
  const seen = new Set<string>();

  function scanSegs(segs: CharterInlineNode[]) {
    for (const seg of segs) {
      if (seg.type === 'text') {
        const s = seg.content.trim();
        if (s && !isUntranslatable(s)) seen.add(seg.content);
      }
    }
  }

  for (const block of blocks) {
    if (block.type === 'heading' || block.type === 'paragraph') {
      scanSegs(block.segments);
    } else if (block.type === 'list') {
      block.items.forEach((it: CharterListItem) => scanSegs(it.segments));
    } else if (block.type === 'table') {
      block.rows.forEach((r: CharterRow) => r.cells.forEach((c) => scanSegs(c.segments)));
    }
  }

  return Array.from(seen);
}

/**
 * Deep-clone blocks, replacing `text` node content using the provided map.
 * Field nodes are left untouched.
 */
export function applyTranslations(
  blocks: CharterBlock[],
  map: Map<string, string>
): CharterBlock[] {
  function translateSegs(segs: CharterInlineNode[]): CharterInlineNode[] {
    return segs.map((seg) => {
      if (seg.type === 'text') {
        const translated = isUntranslatable(seg.content.trim())
          ? seg.content
          : (map.get(seg.content) ?? seg.content);
        return { type: 'text', content: translated };
      }
      return seg;
    });
  }

  return blocks.map((block): CharterBlock => {
    if (block.type === 'heading') {
      return { ...block, segments: translateSegs(block.segments) };
    }
    if (block.type === 'paragraph') {
      return { ...block, segments: translateSegs(block.segments) };
    }
    if (block.type === 'list') {
      return {
        ...block,
        items: block.items.map((it: CharterListItem) => ({
          ...it,
          segments: translateSegs(it.segments),
        })),
      };
    }
    if (block.type === 'table') {
      return {
        ...block,
        rows: block.rows.map((row: CharterRow) => ({
          ...row,
          cells: row.cells.map((cell) => ({
            ...cell,
            segments: translateSegs(cell.segments),
          })),
        })),
      };
    }
    return block;
  });
}
