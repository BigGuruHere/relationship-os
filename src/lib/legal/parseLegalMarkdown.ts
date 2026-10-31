// Safe renderer input for git-tracked legal Markdown. No raw HTML is rendered.
export type LegalBlock = { kind: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet'; text: string };

// Remove display-only Markdown emphasis while preserving all underlying document text.
function displayText(value: string): string {
  return value.replace(/\*\*/g, '');
}

export function legalMarkdownBlocks(source: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let tableHeaders: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: displayText(paragraph.join(' ')) });
    paragraph = [];
  };
  for (const line of lines) {
    const text = line.trim();
    if (!text) { flush(); continue; }
    // Convert legal Markdown tables into accessible labelled rows, without using raw HTML.
    if (text.startsWith('|') && text.endsWith('|')) {
      flush();
      const cells = text.slice(1, -1).split('|').map((cell) => displayText(cell.trim()));
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
      if (!tableHeaders.length) { tableHeaders = cells; continue; }
      const pairs = cells.map((cell, i) => `${tableHeaders[i] || `Column ${i + 1}`}: ${cell}`);
      blocks.push({ kind: 'bullet', text: pairs.join('; ') });
      continue;
    }
    tableHeaders = [];
    const heading = /^(#{1,3})\s+(.+)$/.exec(text);
    if (heading) {
      flush();
      blocks.push({ kind: (`h${heading[1].length}` as 'h1' | 'h2' | 'h3'), text: displayText(heading[2]) });
      continue;
    }
    if (/^---+$/.test(text)) { flush(); continue; }
    const bullet = /^[-*]\s+(.+)$/.exec(text);
    if (bullet) { flush(); blocks.push({ kind: 'bullet', text: displayText(bullet[1]) }); continue; }
    paragraph.push(text);
  }
  flush();
  return blocks;
}
