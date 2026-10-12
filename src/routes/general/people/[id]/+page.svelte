<script lang="ts">export let data:any; export let form:any;</script>
<svelte:head><title>{data.person.name} - General - Relish</title></svelte:head>
<div class="container person-page">
  <a href="/general/people">← General people</a>
  <header><h1>{data.person.name}</h1><p class="muted">Private General-context conversations and evolving Living Understanding.</p><div class="actions"><a class="btn" href={`/general/people/${data.person.id}/understanding`}>Living Understanding</a><a class="btn primary" href={`/general/conversations/import?personId=${encodeURIComponent(data.person.id)}`}>Import conversation</a></div></header>
  <section class="card panel"><h2>Call identity</h2><p class="muted">The phone number is stored encrypted and used to resolve inbound ElevenLabs calls to this General participant.</p><form method="post" action="?/updatePhone" class="phone-form"><input name="phone" inputmode="tel" autocomplete="tel" value={form?.phoneValue ?? data.person.phone ?? ''} placeholder="+61…" /><button class="btn" type="submit">Save phone</button></form>{#if form?.phoneError}<p class="error">{form.phoneError}</p>{:else if form?.phoneSaved}<p class="muted small">Phone saved.</p>{/if}</section>
  <section class="card panel"><h2>Conversation sources</h2><p class="muted">Only this participant's mapped turns are direct evidence about them. Agent turns remain contextual source.</p>
    {#if !data.sources.length}<p class="muted">No imported conversations yet.</p>{/if}
    {#each data.sources as source}
      {@const review = data.reviewBySourceId?.[source.id]}
      <article class="entry"><p class="muted small">{new Date(source.at).toLocaleString()} · {source.provider || 'Conversation'} · {source.speaker || 'Participant'}</p><p>{source.text}</p>
      {#if review?.state === 'IMPACT_REVIEW_READY'}
        <p class="review-state"><strong>New evidence ready for Living Understanding review.</strong> Current authoritative revision: v{review.baselineRevisionNumber}.</p>
        <a class="btn primary" href={review.reviewUrl}>Review impact on Living Understanding →</a>
      {:else if review?.state === 'INITIAL_REVIEW_READY'}
        <p class="review-state"><strong>Ready to create this person's first Living Understanding.</strong></p>
        <a class="btn primary" href={review.reviewUrl}>Create initial Living Understanding →</a>
      {:else if review?.state === 'ALREADY_APPLIED'}
        <p class="muted small">Included in authoritative Living Understanding history.</p>
        <a href={review.reviewUrl}>View Living Understanding →</a>
      {:else}
        <a href={`/general/people/${data.person.id}/understanding?sourceInteractionId=${encodeURIComponent(source.id)}`}>Review source and Living Understanding →</a>
      {/if}
      </article>
    {/each}
  </section>
  <p class="muted small"><strong>Privacy:</strong> General, Dating and Business ContextSpaces remain isolated. Cross-context reuse requires an explicit future custody transition.</p>
</div>
<style>.person-page{max-width:900px;padding:16px}.panel{padding:18px;margin:16px 0}header{margin:15px 0}.actions{display:flex;gap:8px;flex-wrap:wrap}.entry{padding:12px 0;border-top:1px solid var(--border);white-space:pre-wrap}.phone-form{display:flex;gap:8px;align-items:center}.phone-form input{flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text)}.review-state{margin:10px 0}.error{color:var(--danger)}.muted{color:var(--muted)}.small{font-size:.9rem}</style>
