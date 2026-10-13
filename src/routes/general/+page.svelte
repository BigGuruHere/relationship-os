<script lang="ts">
  export let data: any;
</script>
<svelte:head><title>General - Relish</title></svelte:head>
<div class="container general-page">
  <div class="page-head">
    <div>
      <p class="eyebrow">General relationship workspace</p>
      <h1>{data.configured ? 'People and conversations' : 'Create your General space'}</h1>
      <p class="muted">Broad Dorian conversations, participant research and Living Understanding that should not be held inside Dating or Business.</p>
    </div>
    <a class="btn" href="/settings/context-spaces">Manage application spaces</a>
  </div>
  {#if !data.configured}
    <section class="card panel">
      <p>No General ContextSpace exists.</p>
      <a class="btn primary" href="/settings/context-spaces">Set up General space</a>
    </section>
  {:else}
    <section class="stat-grid">
      <a class="card stat" href="/general/people"><span>People</span><strong>{data.people.length}</strong></a>
      <a class="card stat" href="/general/conversations/import"><span>Conversation</span><strong>Import</strong></a>
      <a class="card stat" href="/general/admin/reviews"><span>Operator</span><strong>Review inbox</strong></a>
    </section>
    <section class="card panel safety-note">
      <strong>Custody boundary</strong>
      <p>General information is isolated from Dating and Business. Importing or approving a Living Understanding does not grant matching, sharing or disclosure permission.</p>
    </section>
  {/if}
</div>
<style>
  .general-page { max-width: 1000px; padding: 12px; }
  .page-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
  .panel { padding:16px; margin-bottom:12px; }
  .stat-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-bottom:12px; }
  .stat { padding:14px; text-decoration:none; color:inherit; display:flex; justify-content:space-between; }
  .stat strong { font-size:1.25rem; }
  .eyebrow { color:var(--accent); font-weight:700; text-transform:uppercase; font-size:.8rem; }
  .muted { color:var(--muted); }
  .safety-note { border-color:var(--accent); }
  @media (max-width:700px) { .page-head { flex-direction:column; } .stat-grid { grid-template-columns:1fr; } }
</style>
