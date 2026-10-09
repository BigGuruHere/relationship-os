<script lang="ts">export let data:any;</script>
<svelte:head><title>{data.person.name} - General - Relish</title></svelte:head>
<div class="container person-page">
  <a href="/general/people">← General people</a>
  <header><h1>{data.person.name}</h1><p class="muted">Private General-context conversations and evolving Living Understanding.</p><div class="actions"><a class="btn" href={`/general/people/${data.person.id}/understanding`}>Living Understanding</a><a class="btn primary" href={`/general/conversations/import?personId=${encodeURIComponent(data.person.id)}`}>Import conversation</a></div></header>
  <section class="card panel"><h2>Conversation sources</h2><p class="muted">Only this participant's mapped turns are direct evidence about them. Agent turns remain contextual source.</p>
    {#if !data.sources.length}<p class="muted">No imported conversations yet.</p>{/if}
    {#each data.sources as source}<article class="entry"><p class="muted small">{new Date(source.at).toLocaleString()} · {source.provider || 'Conversation'} · {source.speaker || 'Participant'}</p><p>{source.text}</p><a href={`/general/people/${data.person.id}/understanding?sourceInteractionId=${encodeURIComponent(source.id)}`}>Review source and Living Understanding →</a></article>{/each}
  </section>
  <p class="muted small"><strong>Privacy:</strong> General, Dating and Business ContextSpaces remain isolated. Cross-context reuse requires an explicit future custody transition.</p>
</div>
<style>.person-page{max-width:900px;padding:16px}.panel{padding:18px;margin:16px 0}header{margin:15px 0}.actions{display:flex;gap:8px;flex-wrap:wrap}.entry{padding:12px 0;border-top:1px solid var(--border);white-space:pre-wrap}.muted{color:var(--muted)}.small{font-size:.9rem}</style>
