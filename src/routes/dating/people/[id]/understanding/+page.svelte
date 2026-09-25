<script lang="ts">
  // Stage 8.12.0.1: one initial decision, then explicit Edit and History per statement.
  // All actions are operator actions, never participant confirmation or disclosure permission.
  export let data: any;
  export let form: any;
  let editingId: string | null = null;
</script>
<svelte:head><title>Living Understanding - Relish</title></svelte:head>
<div class="container understanding-page">
  <a href="/dating/people">← Dating people</a>
  <h1>{data.name}: Living Understanding</h1>
  <p class="muted">An evolving, private understanding of what matters to this person. This pilot screen is operated by the workspace administrator.</p>
  <section class="card panel">
    <h2>Add an understanding</h2>
    <p>Begin with one line about their life, interests or what might make a difference for them.</p>
    <form method="POST" action="?/propose">
      <label for="statement">Statement</label>
      <textarea id="statement" name="statement" rows="3" maxlength="600" required placeholder="They enjoy walking and would welcome someone to share that with."></textarea>
      <label for="note">Source or context (optional)</label>
      <textarea id="note" name="note" rows="2" maxlength="1000" placeholder="Their introductory conversation with Dorian"></textarea>
      <div class="actions">
        <button type="submit" name="decision" value="CONFIRMED" class="btn primary">Confirm</button>
        <button type="submit" name="decision" value="DEFERRED" class="btn">Not sure yet</button>
        <button type="submit" name="decision" value="REJECTED" class="btn">Reject</button>
        <button type="submit" name="decision" value="PENDING" class="btn">Save proposal</button>
      </div>
      <p class="muted small">One save creates one statement and its initial decision. Confirm means operator-reviewed, not confirmed by the person.</p>
    </form>
  </section>
  {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
  <section class="panel">
    <h2>Existing statements</h2>
    {#if data.entries.length === 0}<p class="muted">No understanding recorded yet.</p>{/if}
    {#each data.entries as item (item.id)}
      <article class="card entry">
        <p class="muted small">Added {new Date(item.proposedAt).toLocaleString()}</p>
        <p class="current-statement">{item.reviewedStatement ?? item.statement}</p>
        <p><strong>Status:</strong> {item.decision === 'CONFIRMED' ? 'Operator reviewed' : item.decision === 'REJECTED' ? 'Rejected' : item.decision === 'DEFERRED' ? 'Not sure yet' : 'Pending review'}</p>
        <div class="actions">
          <button type="button" class="btn" aria-expanded={editingId === item.id} on:click={() => editingId = editingId === item.id ? null : item.id}>{editingId === item.id ? 'Close edit' : 'Edit'}</button>
        </div>
        {#if editingId === item.id}
          <form method="POST" action="?/review" class="review-form">
            <input type="hidden" name="proposalId" value={item.id} />
            <label for={`review-${item.id}`}>Revise this understanding</label>
            <textarea id={`review-${item.id}`} name="statement" rows="3" maxlength="600" required>{item.reviewedStatement ?? item.statement}</textarea>
            <label for={`note-${item.id}`}>Why has this changed? (optional)</label>
            <input id={`note-${item.id}`} name="note" maxlength="1000" placeholder="A correction or new interpretation of the original experience" />
            <div class="actions">
              <button type="submit" name="decision" value="CONFIRMED" class="btn primary">Confirm</button>
              <button type="submit" name="decision" value="DEFERRED" class="btn">Not sure yet</button>
              <button type="submit" name="decision" value="REJECTED" class="btn">Reject</button>
              <button type="button" class="btn" on:click={() => editingId = null}>Cancel</button>
            </div>
            <p class="muted small">An unchanged decision and statement will not create duplicate history. Genuine revisions are retained.</p>
          </form>
        {/if}
        <details class="history-panel"><summary>History ({item.history.length} review{item.history.length === 1 ? '' : 's'})</summary>
          <div class="history"><strong>Original proposal</strong> · {new Date(item.proposedAt).toLocaleString()}<p>{item.statement}</p>{#if item.proposalNote}<p class="muted">Source: {item.proposalNote}</p>{/if}</div>
          {#each item.history as change}
            <div class="history"><strong>{change.decision}</strong> · {new Date(change.at).toLocaleString()} · {change.actor === 'OPERATOR' ? 'Operator' : change.actor}
              <p>{change.statement}</p>{#if change.note}<p class="muted">{change.note}</p>{/if}
            </div>
          {/each}
        </details>
      </article>
    {/each}
  </section>
  <p class="muted"><strong>Privacy:</strong> Operator confirmation is not independently verified by the participant and does not grant permission to use this information in other spaces or disclose it to anyone.</p>
</div>
<style>
  .understanding-page { max-width: 880px; padding: 14px; }
  .panel { padding: 18px; margin: 15px 0; }
  .entry { padding: 18px; margin: 14px 0; }
  .panel form, .review-form { display: grid; gap: 10px; }
  .review-form { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
  .current-statement { font-size: 1.05rem; white-space: pre-wrap; }
  textarea, input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--text); }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .muted { color: var(--muted); }
  .small { font-size: .9rem; }
  .error { color: var(--danger); }
  .history { margin-top: 10px; padding: 12px; border-top: 1px solid var(--border); }
  .history-panel { margin-top: 12px; }
</style>
