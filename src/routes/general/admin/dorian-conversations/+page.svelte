<script lang="ts">
  // Operator only. All rows and actions are scoped to the signed-in owner's deployments.
  export let data: any;
  export let form: any;
  let filter = 'ALL';
  $: visible = data.calls.filter((call: any) => filter === 'ALL' || call.status === filter);
</script>
<svelte:head><title>Dorian conversation monitor - Relish</title></svelte:head>
<div class="monitor">
  <p class="muted">General / Pilot operations</p><h1>Dorian conversation monitor</h1>
  <p class="muted">Conversation evidence and authoritative Living Understanding outcomes. Incomplete calls are tracked separately below, even if no transcript was imported.</p>
  {#if data.recovered}<p class="success" role="status">Recovery action recorded. Refresh the page to see subsequent worker progress.</p>{/if}
  {#if form?.recoveryError}<p class="error" role="alert">{form.recoveryError}</p>{/if}
  <section class="recovery">
    <h2>Call recovery</h2>
    <p class="muted">A stuck call is not automatically released. Confirm the call ended with ElevenLabs before releasing it. Never mark a WORKING job failed until the worker processing it has been stopped.</p>
    {#if !data.recovery.items.length}
      <p>No blocked or unfinished call gates found among the most recent sessions.</p>
    {:else}
      {#each data.recovery.items as item (item.sessionId)}
        <article class="recovery-item">
          <div class="head"><strong>{item.kind === 'PHONE' ? 'Telephone call' : 'Pilot callback'} · {item.state}</strong>
            <span class:warning={item.stale} class="state">{item.stale ? 'Requires attention' : 'In progress / monitoring'}</span></div>
          <p class="muted">{new Date(item.createdAt).toLocaleString()} · State age {item.ageMinutes === null ? 'unknown' : `${item.ageMinutes} minutes`} · {item.hasEvidence ? 'Verified transcript/source available' : 'No verified participant transcript/source'}</p>
          <details><summary>Conversation identifier</summary><code>{item.conversationId}</code></details>
          {#if item.actions.length}
            <form method="POST" action="?/recover" class="recover-form">
              <input type="hidden" name="sessionId" value={item.sessionId} />
              <label>Action
                <select name="operation" required>
                  <option value="" disabled selected>Choose an action</option>
                  {#if item.actions.includes('RETRY')}<option value="RETRY">Retry learning from verified evidence</option>{/if}
                  {#if item.actions.includes('RELEASE')}<option value="RELEASE">Release caller / skip unfinished learning</option>{/if}
                  {#if item.actions.includes('MARK_FAILED')}<option value="MARK_FAILED">Mark stopped worker as failed</option>{/if}
                </select>
              </label>
              <label>Reason
                <select name="reasonCode" required>
                  <option value="" disabled selected>Choose reason</option>
                  {#if item.state === 'IN_CALL'}<option value="PROVIDER_CALL_ENDED">Provider confirms call ended</option>{/if}
                  {#if item.state !== 'IN_CALL'}
                    <option value="PROCESSING_STALLED">Processing stalled</option>
                    <option value="SKIP_UNRECOVERABLE">Cannot recover source / skipping</option>
                    {#if item.state === 'WORKING'}<option value="WORKER_STOPPED">Worker stopped and confirmed inactive</option>{/if}
                  {/if}
                </select>
              </label>
              {#if item.actions.includes('RELEASE') || item.state === 'IN_CALL'}
                <label class="check"><input type="checkbox" name="confirmedEnded" value="yes" /> I checked ElevenLabs and confirm this call has ended.</label>
              {/if}
              {#if item.actions.includes('MARK_FAILED')}
                <label class="check"><input type="checkbox" name="confirmedWorkerStopped" value="yes" /> I stopped every worker processing this call and confirm none is still running.</label>
              {/if}
              <button type="submit">Apply audited recovery</button>
            </form>
          {:else}
            <p class="muted">No action yet. Active or recently queued processing must not be interrupted. Refresh later or check worker activity.</p>
          {/if}
        </article>
      {/each}
    {/if}
    <details class="history"><summary>Recent recovery actions ({data.recovery.events.length})</summary>
      {#if !data.recovery.events.length}<p>No operator recovery actions yet.</p>{/if}
      {#each data.recovery.events as event (event.id)}
        <p class="muted">{new Date(event.createdAt).toLocaleString()} · {event.operation} · {event.previousState || '—'} → {event.nextState || '—'} · {event.reasonCode}</p>
      {/each}
    </details>
  </section>
  <section>
    <h2>Imported conversations</h2>
    <div class="controls"><label for="status">Status</label><select id="status" bind:value={filter}>
      <option value="ALL">All</option><option value="APPLIED">Applied to understanding</option>
      <option value="NO_CHANGE">No understanding change</option><option value="FAILED">Failed</option><option value="PROCESSING">Processing</option><option value="PENDING">Pending or needs review</option>
    </select><a href="/general/admin/pilot-phone-reviews">Legacy review inbox</a></div>
    {#if !visible.length}<p>No imported conversations match this filter.</p>{/if}
    {#each visible as call (call.id)}
      <article class="call"><div><h3>{call.participantName}</h3><p class="muted">{new Date(call.occurredAt).toLocaleString()} · {call.status}</p>
        <p>{call.summary || call.transcript.slice(0, 230) || 'Conversation imported.'}</p>
        <p>{call.revisionNumber ? `Applied to authoritative revision ${call.revisionNumber}` : call.status === 'NO_CHANGE' ? 'Validated: no Living Understanding change required.' : call.status === 'FAILED' ? 'Automatic processing failed; operator recovery required.' : call.contextState === 'RELEASED_UNPROCESSED' ? 'Recovery: caller released without applying learning.' : 'No authoritative revision linked to this call yet.'}</p></div>
        <a href={`/general/admin/dorian-conversations/${encodeURIComponent(call.id)}`}>View call and learning outcome</a></article>
    {/each}
  </section>
</div>
<style>
.monitor{max-width:1050px;margin:0 auto;padding:22px}.muted{color:var(--muted)}.success{padding:12px;background:var(--surface,transparent);border:1px solid var(--border);border-radius:8px}.error{color:#a12424;font-weight:600}.recovery{padding:20px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}.recovery h2{margin-top:0}.recovery-item{padding:18px 0;border-top:1px solid var(--border)}.head{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}.state{font-size:.9rem}.warning{font-weight:650}.recover-form{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0;align-items:end}.recover-form>label{display:flex;flex-direction:column;gap:5px;min-width:215px}.recover-form .check{flex-basis:100%;flex-direction:row;align-items:center}.recover-form button{min-height:38px;padding:7px 14px;cursor:pointer}.recover-form select{max-width:100%;padding:8px}.history{margin-top:12px}.controls{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:20px 0}.call{display:flex;gap:15px;justify-content:space-between;align-items:start;padding:18px 0;border-top:1px solid var(--border)}.call h3{font-size:1.1rem;margin:0}.call>div{flex:1}.recovery details code{overflow-wrap:anywhere}@media(max-width:700px){.call{flex-direction:column}}
</style>
