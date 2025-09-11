<script lang="ts">
    export let data;
  </script>
  
  <h1>📇 My Contacts</h1>
  
  <p><a href="/contacts/new">➕ Add Contact</a></p>
  
  {#if data.error}
    <p style="color:crimson">{data.error}</p>
  {/if}
  
  {#if data.contacts.length === 0 && !data.error}
    <p>No contacts yet. Start by <a href="/contacts/new">adding one</a>.</p>
  {:else if data.contacts.length > 0}
    <ul>
      {#each data.contacts as c}
        <li>
          <a href={"/contacts/" + c.id}>Contact {c.id.slice(0, 8)}</a>
          <small> (created {new Date(c.createdAt).toLocaleString()})</small>
        </li>
      {/each}
    </ul>
  {/if}
  