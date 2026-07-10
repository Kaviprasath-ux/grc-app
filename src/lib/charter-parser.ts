import mammoth from 'mammoth';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CharterInlineNode =
  | { type: 'text'; content: string }
  | { type: 'field'; id: string; defaultValue: string };

export type CharterTableCell = {
  segments: CharterInlineNode[];
  isHeader: boolean;
};

export type CharterRow = {
  cells: CharterTableCell[];
};

export type CharterListItem = {
  segments: CharterInlineNode[];
};

export type CharterBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; segments: CharterInlineNode[] }
  | { type: 'paragraph'; segments: CharterInlineNode[] }
  | { type: 'table'; rows: CharterRow[] }
  | { type: 'list'; ordered: boolean; items: CharterListItem[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBlueHex(hex: string): boolean {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Blue is dominant and meaningfully blue
  return b >= 80 && b > r + 10 && b > g - 40;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Extracts inline nodes from HTML, turning blue-color spans into editable fields.
function parseInline(html: string, idx: { n: number }): CharterInlineNode[] {
  const nodes: CharterInlineNode[] = [];
  // Match any <span> with a style attribute
  const spanRe = /<span\s([^>]*)>([\s\S]*?)<\/span>/gi;
  let lastEnd = 0;
  let m: RegExpExecArray | null;

  while ((m = spanRe.exec(html)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const start = m.index;

    // Only care about spans that have a style with a color
    const styleM = attrs.match(/style="([^"]*)"/);
    if (!styleM) continue;
    const colorM = styleM[1].match(/\bcolor:\s*#?([0-9a-fA-F]{6})\b/);
    if (!colorM || !isBlueHex(colorM[1])) continue;

    // Static text before this blue span
    if (start > lastEnd) {
      const txt = stripHtml(html.slice(lastEnd, start));
      if (txt) nodes.push({ type: 'text', content: txt });
    }

    // Blue span → editable field
    const fieldText = stripHtml(inner);
    nodes.push({ type: 'field', id: `field_${idx.n++}`, defaultValue: fieldText });
    lastEnd = start + m[0].length;
  }

  // Remaining text
  if (lastEnd < html.length) {
    const txt = stripHtml(html.slice(lastEnd));
    if (txt) nodes.push({ type: 'text', content: txt });
  }

  // Fallback: entire content is static text
  if (nodes.length === 0) {
    const txt = stripHtml(html);
    if (txt) return [{ type: 'text', content: txt }];
  }

  return nodes;
}

function hasVisibleContent(nodes: CharterInlineNode[]): boolean {
  return nodes.some(
    (n) => n.type === 'field' || (n.type === 'text' && n.content.trim().length > 0)
  );
}

// Parse a <table> HTML fragment into rows
function parseTableHtml(tableHtml: string, idx: { n: number }): CharterRow[] {
  const rows: CharterRow[] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(tableHtml)) !== null) {
    const cells: CharterTableCell[] = [];
    const cellRe = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      cells.push({
        segments: parseInline(cm[2], idx),
        isHeader: cm[1].toLowerCase() === 'th',
      });
    }
    if (cells.length > 0) rows.push({ cells });
  }
  return rows;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function parseDocxToBlocks(buffer: Buffer): Promise<CharterBlock[]> {
  const { value: html } = await mammoth.convertToHtml({ buffer });

  const blocks: CharterBlock[] = [];
  const idx = { n: 0 };
  let pos = 0;

  function consume(len: number) {
    pos += len;
  }

  while (pos < html.length) {
    // Skip whitespace between blocks
    while (pos < html.length && /\s/.test(html[pos])) pos++;
    if (pos >= html.length) break;

    // Must start with a tag
    if (html[pos] !== '<') {
      pos++;
      continue;
    }

    // Extract tag name
    const tagM = html.slice(pos).match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
    if (!tagM) { pos++; continue; }
    const tag = tagM[1].toLowerCase();

    // Find end of opening tag
    const openEnd = html.indexOf('>', pos);
    if (openEnd === -1) break;

    if (/^h[1-6]$/.test(tag)) {
      const closeTag = `</${tag}>`;
      const closePos = html.indexOf(closeTag, openEnd + 1);
      if (closePos === -1) { consume(openEnd + 1 - pos); continue; }
      const inner = html.slice(openEnd + 1, closePos);
      const level = parseInt(tag[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
      const segments = parseInline(inner, idx);
      if (hasVisibleContent(segments)) blocks.push({ type: 'heading', level, segments });
      consume(closePos + closeTag.length - pos);

    } else if (tag === 'p') {
      const closePos = html.indexOf('</p>', openEnd + 1);
      if (closePos === -1) { consume(openEnd + 1 - pos); continue; }
      const inner = html.slice(openEnd + 1, closePos);
      const segments = parseInline(inner, idx);
      if (hasVisibleContent(segments)) blocks.push({ type: 'paragraph', segments });
      consume(closePos + '</p>'.length - pos);

    } else if (tag === 'table') {
      // Find matching </table> handling nesting
      let depth = 1;
      let search = openEnd + 1;
      let tableEnd = -1;
      while (search < html.length && depth > 0) {
        const nextOpen = html.indexOf('<table', search);
        const nextClose = html.indexOf('</table>', search);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          search = nextOpen + 6;
        } else {
          depth--;
          if (depth === 0) tableEnd = nextClose + '</table>'.length;
          search = nextClose + 8;
        }
      }
      if (tableEnd === -1) { consume(openEnd + 1 - pos); continue; }
      const tableHtml = html.slice(pos, tableEnd);
      const rows = parseTableHtml(tableHtml, idx);
      if (rows.length > 0) blocks.push({ type: 'table', rows });
      consume(tableEnd - pos);

    } else if (tag === 'ul' || tag === 'ol') {
      const closeTag = `</${tag}>`;
      const closePos = html.indexOf(closeTag, openEnd + 1);
      if (closePos === -1) { consume(openEnd + 1 - pos); continue; }
      const inner = html.slice(openEnd + 1, closePos);
      const items: CharterListItem[] = [];
      const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let lm: RegExpExecArray | null;
      while ((lm = liRe.exec(inner)) !== null) {
        const segs = parseInline(lm[1], idx);
        if (hasVisibleContent(segs)) items.push({ segments: segs });
      }
      if (items.length > 0) blocks.push({ type: 'list', ordered: tag === 'ol', items });
      consume(closePos + closeTag.length - pos);

    } else {
      // Unknown block tag — skip to end of the tag (self-closing or skip)
      const closeTag = `</${tag}>`;
      const closePos = html.indexOf(closeTag, openEnd + 1);
      consume((closePos === -1 ? openEnd + 1 : closePos + closeTag.length) - pos);
    }
  }

  return blocks;
}
