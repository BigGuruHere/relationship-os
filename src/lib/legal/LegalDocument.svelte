<script lang="ts">
  // Bundled Markdown is rendered as escaped text, never as HTML.
  import { legalMarkdownBlocks } from './parseLegalMarkdown';
  export let markdown: string;
  export let version: string;
  export let published: boolean;
  $: blocks = legalMarkdownBlocks(markdown);
</script>
<svelte:head>
  <title>{blocks.find((block) => block.kind === 'h1')?.text || 'Relish Policy'} | Relish</title>
  <meta name="robots" content={published ? 'index,follow' : 'noindex,nofollow'} />
</svelte:head>
<div class="legal-document">
  <a href="/legal" class="back">← Terms &amp; Privacy overview</a>
  {#if !published}
    <div role="status" class="draft">Draft for review. These documents have not yet been published as binding Relish policies.</div>
  {/if}
  {#each blocks as block, i (i)}
    {#if block.kind === 'h1'}<h1>{block.text}</h1>
    {:else if block.kind === 'h2'}<h2>{block.text}</h2>
    {:else if block.kind === 'h3'}<h3>{block.text}</h3>
    {:else if block.kind === 'bullet'}<p class="bullet">• {block.text}</p>
    {:else}<p>{block.text}</p>{/if}
  {/each}
  <p class="version">Configured Relish policy version: {version || 'Not configured'}</p>
</div>
<style>
  .legal-document { max-width: 800px; margin: 0 auto; padding: 30px 18px 70px; line-height: 1.65; }
  .back { color: #12665c; font-weight: 600; }
  h1 { font-size: clamp(1.65rem,4vw,2.4rem); margin: 1rem 0; color: #173d39; }
  h2 { font-size: 1.22rem; margin: 1.6rem 0 .5rem; color: #173d39; }
  h3 { font-size: 1.05rem; margin: 1rem 0 .4rem; }
  p { margin: .65rem 0; }
  .bullet { padding-left: 1rem; }
  .draft { margin: 20px 0; border: 1px solid #b45309; border-radius: 8px; padding: 12px; background: #fff7ed; color: #78350f; }
  .version { border-top: 1px solid #d5ddd9; padding-top: 14px; margin-top: 30px; font-size: .82rem; color: #52655f; }
</style>
