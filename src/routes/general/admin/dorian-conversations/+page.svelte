<script lang="ts">
  // Operator-only call monitor. All returned rows have been checked on the server.
  export let data: any;
  let filter = 'ALL';
  $: visible = data.calls.filter((call: any) => filter === 'ALL' || call.status === filter);
</script>
<svelte:head><title>Dorian conversation monitor - Relish</title></svelte:head>
<div class="monitor">
  <p class="muted">General / Pilot operations</p><h1>Dorian conversation monitor</h1>
  <p class="muted">Imported conversations and their actual Living Understanding outcomes. Completed updates remain visible.</p>
  <div class="controls"><label for="status">Status</label><select id="status" bind:value={filter}>
    <option value="ALL">All</option><option value="APPLIED">Applied to understanding</option>
    <option value="PROCESSING">Processing</option><option value="PENDING">Pending or needs review</option>
  </select><a href="/general/admin/pilot-phone-reviews">Legacy review inbox</a></div>
  {#if !visible.length}<p>No imported conversations match this filter.</p>{/if}
  {#each visible as call (call.id)}
    <article class="call"><div><h2>{call.participantName}</h2><p class="muted">{new Date(call.occurredAt).toLocaleString()} · {call.status}</p>
      <p>{call.summary || call.transcript.slice(0, 230) || 'Conversation imported.'}</p>
      <p>{call.revisionNumber ? `Applied to authoritative revision ${call.revisionNumber}` : 'No authoritative revision linked to this call yet.'}</p></div>
      <a href={`/general/admin/dorian-conversations/${encodeURIComponent(call.id)}`}>View call and learning outcome</a></article>
  {/each}
</div>
<style>
.monitor{max-width:1000px;margin:0 auto;padding:22px}.muted{color:var(--muted)}.controls{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:20px 0}.call{display:flex;gap:15px;justify-content:space-between;align-items:start;padding:18px 0;border-top:1px solid var(--border)}.call h2{font-size:1.1rem;margin:0}.call>div{flex:1}@media(max-width:700px){.call{flex-direction:column}}
</style>
