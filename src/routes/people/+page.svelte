<script lang="ts">
  // Owner-only legacy Personal classification is reflected in this directory.
  // Non-owner participants retain their existing private My People experience.
  export let data: any;
</script>

<svelte:head><title>My People - Relish</title></svelte:head>

<div class="container people-page">
  <h1>My People</h1>
  <p>Your private contacts and notes. Adding someone does not invite or connect them.</p>
  <div class="people-actions">
    <a class="btn primary" href="/people/new">Add Person</a>
    {#if data.isOwner}
      <a class="btn" href="/people/organise">Organise Contacts</a>
    {/if}
  </div>

  <form method="GET" class="people-search">
    <label for="q">Search your people</label>
    <input id="q" name="q" value={data.q} placeholder="Name, email or phone" />
    <button class="btn" type="submit">Search</button>
  </form>

  {#if data.people.length}
    <h2>{data.q ? 'Search results' : 'Recently added'}</h2>
    <ul class="people-list">
      {#each data.people as person}
        <li>
          <a href={person.href}>
            <strong>{person.name}</strong>
            {#if person.email || person.phone}<span>{person.email || person.phone}</span>{/if}
            {#if data.isOwner && person.origin === 'Business'}<small>Business · Personal</small>{/if}
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <p>{data.q ? 'No matching people.' : 'Add someone you met, then record what you want to remember.'}</p>
  {/if}

  {#if data.isOwner}
    <p class="muted">Legacy Brokerage Contacts marked Personal appear here without changing their original storage or history.</p>
  {:else}
    <p class="muted">Existing Brokerage contacts remain in their current workspace.</p>
  {/if}
</div>

<style>
  .people-page { max-width: 760px; padding: 20px; }
  .people-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .people-search { display: grid; gap: 8px; margin: 24px 0; }
  .people-search input { width: 100%; padding: 12px; }
  .people-list { list-style: none; padding: 0; }
  .people-list li { border-bottom: 1px solid var(--border); }
  .people-list a { display: grid; gap: 4px; padding: 16px 0; overflow-wrap: anywhere; }
  .people-list span, .people-list small { font-size: .9rem; }
  .btn { min-height: 44px; }
</style>
