// Stage 8.19a: minimal, safe renderer input for git-tracked legal Markdown.
// Svelte escapes each text block automatically. Deliberately no raw HTML support.
export type LegalBlock = { kind: 'h1' | 'h2' | 'h3' | 'paragraph' | 'bullet'; text: string };

export function legalMarkdownBlocks(source: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  for (const line of lines) {
    const text = line.trim();
    if (!text) { flush(); continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(text);
    if (heading) {
      flush();
      blocks.push({ kind: (`h${heading[1].length}` as 'h1' | 'h2' | 'h3'), text: heading[2] });
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(text);
    if (bullet) { flush(); blocks.push({ kind: 'bullet', text: bullet[1] }); continue; }
    paragraph.push(text);
  }
  flush();
  return blocks;
}
