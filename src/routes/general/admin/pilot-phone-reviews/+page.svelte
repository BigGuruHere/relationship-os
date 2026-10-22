<script lang="ts">
  export let data: any;
</script>
<svelte:head><title>Pilot phone reviews - Relish</title></svelte:head>
<div class="container" style="max-width:950px;padding:20px">
  <p class="eyebrow">General / Administration</p>
  <h1>Provisional telephone reviews</h1>
  <p>This is a restricted operator queue for telephone participants who have not created an authenticated account. It is currently <strong>read-only</strong>; reviewing and approving another person's authoritative understanding requires a separate audited delegated-custody workflow.</p>
  <p>{data.pending.length} pending conversation{data.pending.length === 1 ? '' : 's'}; {data.dismissedCount} dismissed.</p>
  {#each data.pending as item}
    <article class="card" style="margin:12px 0;padding:16px">
      <p class="muted">{new Date(item.occurredAt).toLocaleString()} · {item.state}</p>
      <h2>{item.participantName}</h2>
      <p>{item.summary || item.preview || 'Conversation imported'}</p>
      <p class="muted">{item.baselineRevisionNumber ? `Current understanding: v${item.baselineRevisionNumber}` : 'Initial understanding not yet approved'}</p>
    </article>
  {:else}
    <p>No provisional caller conversations are waiting for review.</p>
  {/each}
  <a href="/general/admin/reviews">Return to my review inbox</a>
</div>
