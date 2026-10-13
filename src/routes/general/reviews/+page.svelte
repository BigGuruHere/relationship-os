<script lang="ts">
  export let data: any;
  export let form: any;
  let showDismissed = false;

  function confirmDismiss(event: SubmitEvent) {
    const ok = window.confirm('Dismiss this conversation from Living Understanding review? The conversation will remain stored, but it will not be incorporated into Living Understanding unless you restore it.');
    if (!ok) event.preventDefault();
  }
</script>

<svelte:head><title>Living Understanding reviews - Relish</title></svelte:head>
<div class="container review-page">
  <div class="page-head"><div><p class="eyebrow">General workspace</p><h1>Living Understanding reviews</h1><p class="muted">Supervise automatic conversation proposals before anything becomes authoritative.</p></div><a class="btn" href="/general/people">People</a></div>
  {#if form?.reviewError}<p class="error" role="alert">{form.reviewError}</p>{/if}

  <section class="card panel">
    <div class="section-head"><div><h2>Pending</h2><p class="muted small">{data.pending.length} conversation{data.pending.length === 1 ? '' : 's'} waiting for a decision.</p></div></div>
    {#if !data.pending.length}<p class="muted">Nothing is waiting for review.</p>{/if}
    {#each data.pending as item}
      <article class="review-item">
        <div class="review-main"><p class="muted small">{new Date(item.occurredAt).toLocaleString()} · {item.provider}</p><h3>{item.participantName}</h3>
          <p>{item.summary || item.preview || 'Conversation imported.'}</p>
          <p class="muted small">{item.state === 'INITIAL_REVIEW_READY' ? 'Initial Living Understanding' : `Current authoritative revision: v${item.baselineRevisionNumber}`}{item.proposalReady ? ' · Automatic proposal ready' : ''}</p>
        </div>
        <div class="review-actions"><a class="btn primary" href={item.reviewUrl}>Review</a>
          <form method="POST" action="?/dismiss" onsubmit={confirmDismiss}>
            <input type="hidden" name="sourceInteractionId" value={item.sourceInteractionId} /><input type="hidden" name="contactId" value={item.contactId} />
            <button class="btn" type="submit">Dismiss</button>
          </form>
        </div>
      </article>
    {/each}
  </section>

  <section class="card panel">
    <button class="link-button" type="button" onclick={() => showDismissed = !showDismissed}>{showDismissed ? 'Hide' : 'Show'} dismissed ({data.dismissed.length})</button>
    {#if showDismissed}
      {#if !data.dismissed.length}<p class="muted">No dismissed conversations.</p>{/if}
      {#each data.dismissed as item}
        <article class="review-item dismissed"><div class="review-main"><p class="muted small">{new Date(item.occurredAt).toLocaleString()} · {item.provider}</p><h3>{item.participantName}</h3><p>{item.summary || item.preview || 'Conversation imported.'}</p><p class="muted small">Dismissed from Living Understanding review. The stored conversation has not been deleted.</p></div>
          <div class="review-actions"><form method="POST" action="?/restore"><input type="hidden" name="sourceInteractionId" value={item.sourceInteractionId} /><input type="hidden" name="contactId" value={item.contactId} /><button class="btn" type="submit">Restore</button></form></div>
        </article>
      {/each}
    {/if}
  </section>
</div>
<style>
.review-page{max-width:980px;padding:16px}.page-head,.section-head,.review-item,.review-actions{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}.panel{padding:18px;margin:16px 0}.review-item{padding:16px 0;border-top:1px solid var(--border)}.review-main{min-width:0;flex:1}.review-main h3{margin:.2rem 0}.review-actions{align-items:center;flex-wrap:wrap}.review-actions form{margin:0}.dismissed{opacity:.78}.eyebrow{color:var(--accent);font-weight:700;text-transform:uppercase;font-size:.8rem}.muted{color:var(--muted)}.small{font-size:.9rem}.error{color:var(--danger)}.link-button{border:0;background:none;color:var(--accent);padding:0;cursor:pointer;font:inherit;font-weight:700}@media(max-width:700px){.page-head,.review-item{flex-direction:column}.review-actions{width:100%}}
</style>
