<!-- PURPOSE: Render decrypted names returned by the server -->
<script lang="ts">
  export let data;
</script>

<h1>📇 My Contacts</h1>
<p><a href="/contacts/new">➕ Add Contact</a></p>

{#if data.contacts.length === 0}
  <p>No contacts yet. Start by <a href="/contacts/new">adding one</a>.</p>
{:else}
  <ul>
    {#each data.contacts as c}
      <li>
        <a href={"/contacts/" + c.id}>{c.name}</a>
        <small> (added {new Date(c.createdAt).toLocaleString()})</small>
      </li>
    {/each}
  </ul>
{/if}
