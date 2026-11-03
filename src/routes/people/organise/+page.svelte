<script lang="ts">
  // Owner-only organisational view; server guards both page loads and mutations.
  export let data: any;
  export let form: any;

  function submitPersonalToggle(event: Event) {
    // IT: Submit the enclosing form after a checkbox change, without a client API.
    (event.currentTarget as HTMLInputElement).form?.requestSubmit();
  }
</script>

<svelte:head><title>Organise Contacts - Relish</title></svelte:head>

<div class="container people-organiser">
  <a href="/people">← My People</a>
  <h1>Organise Contacts</h1>
  <p>This owner-only screen helps you find legacy Brokerage Contacts and mark them as personal. No Contacts or notes are moved, copied or shared.</p>

  <form method="GET" class="organiser-search">
    <label for="contact-search">Search all your Contacts</label>
    <input id="contact-search" name="q" value={data.q} placeholder="Name, email or phone" />
    <button class="btn" type="submit">Search</button>
  </form>

  {#if form?.error}<p role="alert">{form.error}</p>{/if}

  <p class="muted">{data.contacts.length} {data.q ? 'matching' : 'total'} Contacts. Private Contacts already appear in My People.</p>
  {#if data.contacts.length}
    <ul class="organiser-list">
      {#each data.contacts as person}
        <li>
          <div class="organiser-contact">
            <a href={person.href}><strong>{person.name}</strong></a>
            {#if person.email || person.phone}<small>{person.email || person.phone}</small>{/if}
            <small class="muted">Stored in {person.origin}</small>
          </div>
          {#if person.origin === 'Business'}
            <form method="POST" action="?/toggle" class="organiser-toggle">
              <input type="hidden" name="contactId" value={person.id} />
              <input type="hidden" name="contextSpaceId" value={person.contextSpaceId} />
              <input type="hidden" name="personal" value={person.personal ? '0' : '1'} />
              <input type="hidden" name="q" value={data.q} />
              <label>
                <input type="checkbox" checked={person.personal} on:change={submitPersonalToggle} />
                <span>Personal</span>
              </label>
              <button class="btn" type="submit">Save</button>
            </form>
          {:else}
            <span class="muted">Already in My People</span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p>No Contacts match this search.</p>
  {/if}
  <p class="muted">Personal is a directory label, not permission to share private information. Business history stays in its original context.</p>
</div>

<style>
  .people-organiser { max-width: 900px; padding: 20px; }
  .organiser-search { display: grid; gap: 8px; margin: 20px 0; }
  .organiser-search input { padding: 12px; width: 100%; }
  .organiser-list { list-style: none; padding: 0; margin: 0; }
  .organiser-list li { display: flex; justify-content: space-between; align-items: center; gap: 18px; border-bottom: 1px solid var(--border); padding: 14px 0; flex-wrap: wrap; }
  .organiser-contact { display: grid; gap: 5px; overflow-wrap: anywhere; min-width: 170px; flex: 1; }
  .organiser-toggle { display: flex; align-items: center; gap: 12px; }
  .organiser-toggle label { display: flex; gap: 8px; align-items: center; cursor: pointer; }
  .organiser-toggle input { width: 20px; height: 20px; }
  .muted { color: var(--text-muted, #737373); }
  .btn { min-height: 40px; }
  @media (max-width: 540px) { .organiser-toggle { width: 100%; justify-content: space-between; } }
</style>
