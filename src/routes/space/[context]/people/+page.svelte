<script lang="ts">
  export let data: any;
</script>
<svelte:head><title>People - {data.workspace.label} - Relish</title></svelte:head>
<div class="workspace-page">
  <p class="workspace-kicker">{data.workspace.label.toUpperCase()} / PEOPLE</p>
  <h1>People</h1>
  <p class="workspace-intro">This is your {data.workspace.label.toLowerCase()} network. Private conversations with Dorian aren't shared with the person who invited you.</p>
  {#if data.people.length}
    <section class="workspace-panel">
      {#each data.people as person}
        <div class="workspace-person" style="align-items:flex-start">
          <div>
            <strong>{#if person.profileSlug}<a href={'/u/' + encodeURIComponent(person.profileSlug)}>{person.name}</a>{:else}{person.name}{/if}</strong>
            {#if person.email}<p style="margin:4px 0"><a href={'mailto:' + encodeURIComponent(person.email)}>{person.email}</a></p>{/if}
            <small>{new Date(person.since).toLocaleDateString()}</small>
          </div>
          {#if person.status === 'REQUESTED'}
            <form method="POST" action="?/approve">
              <input type="hidden" name="requestId" value={person.id}/>
              <button class="btn" type="submit">Accept</button>
            </form>
          {/if}
          <span>{person.status === 'CONNECTED' ? 'Connected' : person.status === 'SENT' ? 'Request sent' : person.status === 'ACCEPTED' ? 'Accepted' : 'Requested'}</span>
        </div>
      {/each}
    </section>
  {:else}
    <section class="workspace-panel">
      <h2>No connections here yet</h2>
      <p>People who share their details or connect in this context will appear here.</p>
      <a class="btn primary" href={'/space/' + data.workspace.name + '/share'}>Share my profile</a>
    </section>
  {/if}
</div>
