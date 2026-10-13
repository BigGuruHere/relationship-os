<script lang="ts">
  export let data: any;
  export let form: any;

  function reviewLabel(review: any) {
    if (!review) return 'Living Understanding status unavailable';
    if (review.state === 'DISMISSED') return 'Dismissed from Living Understanding review';
    if (review.state === 'ALREADY_APPLIED') return 'Included in authoritative Living Understanding';
    if (review.state === 'INITIAL_REVIEW_READY') return 'Pending initial Living Understanding review';
    if (review.state === 'IMPACT_REVIEW_READY') return `Pending Living Understanding review from v${review.baselineRevisionNumber}`;
    return 'Living Understanding status unavailable';
  }

  function reviewClass(review: any) {
    if (!review) return 'neutral';
    if (review.state === 'DISMISSED') return 'dismissed';
    if (review.state === 'ALREADY_APPLIED') return 'included';
    if (review.state === 'INITIAL_REVIEW_READY' || review.state === 'IMPACT_REVIEW_READY') return 'pending';
    return 'neutral';
  }
</script>

<svelte:head><title>{data.person.name} - General - Relish</title></svelte:head>

<div class="container person-page">
  <a href="/general/people">← General people</a>

  <header>
    <h1>{data.person.name}</h1>
    <p class="muted">Private General-context conversations and evolving Living Understanding.</p>
    <div class="actions">
      <a class="btn" href={`/general/people/${data.person.id}/understanding`}>Living Understanding</a>
      <a class="btn primary" href={`/general/conversations/import?personId=${encodeURIComponent(data.person.id)}`}>Import conversation</a>
    </div>
  </header>

  <section class="card panel">
    <h2>Call identity</h2>
    <p class="muted">The phone number is stored encrypted and used to resolve inbound ElevenLabs calls to this General participant.</p>
    <form method="post" action="?/updatePhone" class="phone-form">
      <input name="phone" inputmode="tel" autocomplete="tel" value={form?.phoneValue ?? data.person.phone ?? ''} placeholder="+61…" />
      <button class="btn" type="submit">Save phone</button>
    </form>
    {#if form?.phoneError}<p class="error">{form.phoneError}</p>{:else if form?.phoneSaved}<p class="muted small">Phone saved.</p>{/if}
  </section>

  <section class="card panel">
    <div class="section-head">
      <div>
        <h2>Conversation history</h2>
        <p class="muted">Chronological record of stored conversations. Living Understanding decisions are handled in the General operator review inbox.</p>
      </div>
    </div>

    {#if !data.sources.length}<p class="muted">No imported conversations yet.</p>{/if}

    {#each data.sources as source}
      {@const review = data.reviewBySourceId?.[source.id]}
      <article class="entry">
        <div class="entry-head">
          <p class="muted small">{new Date(source.at).toLocaleString()} · {source.provider || 'Conversation'} · {source.speaker || 'Participant'}</p>
          <div class="status-row" aria-label="Conversation and Living Understanding status">
            <span class="status stored">Imported</span>
            <span class={`status ${reviewClass(review)}`}>{reviewLabel(review)}</span>
          </div>
        </div>
        <p>{source.text}</p>
        {#if review?.state === 'DISMISSED'}
          <p class="muted small">The conversation remains in history, but it will not affect Living Understanding unless restored from the General operator review inbox.</p>
        {:else if review?.state === 'ALREADY_APPLIED'}
          <p class="muted small">This conversation has already contributed to authorised Living Understanding history.</p>
        {:else if review?.state === 'INITIAL_REVIEW_READY' || review?.state === 'IMPACT_REVIEW_READY'}
          <p class="muted small">This conversation is waiting for a decision in the General operator review inbox.</p>
        {/if}
      </article>
    {/each}
  </section>

  <p class="muted small"><strong>Privacy:</strong> General, Dating and Business ContextSpaces remain isolated. Cross-context reuse requires an explicit future custody transition.</p>
</div>

<style>
.person-page{max-width:900px;padding:16px}.panel{padding:18px;margin:16px 0}header{margin:15px 0}.actions,.section-head,.status-row{display:flex;gap:8px;flex-wrap:wrap}.section-head{justify-content:space-between;align-items:flex-start}.entry{padding:14px 0;border-top:1px solid var(--border);white-space:pre-wrap}.entry-head{display:grid;gap:7px}.entry-head p{margin-bottom:0}.status{display:inline-flex;align-items:center;width:max-content;padding:3px 8px;border:1px solid var(--border);border-radius:999px;font-size:.78rem;font-weight:700;white-space:normal}.status.stored,.status.neutral{color:var(--muted)}.status.pending{color:var(--accent)}.status.included{color:var(--text)}.status.dismissed{color:var(--muted);opacity:.8}.phone-form{display:flex;gap:8px;align-items:center}.phone-form input{flex:1;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text)}.error{color:var(--danger)}.muted{color:var(--muted)}.small{font-size:.9rem}@media(max-width:700px){.section-head{flex-direction:column}.phone-form{align-items:stretch;flex-direction:column}}
</style>
