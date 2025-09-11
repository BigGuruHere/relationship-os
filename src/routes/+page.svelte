<script lang="ts">
  // src/routes/+page.svelte
  
  export let data;
</script>

<div class="container">
  <div class="card" style="padding:18px 18px 8px;">
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
      <h1 style="margin:0;">📇 My Contacts</h1>
      <a class="btn primary" href="/contacts/new">➕ Add Contact</a>
    </div>

    {#if data.contacts.length === 0}
      <p style="color:var(--muted);">No contacts yet. Start by adding one.</p>
    {:else}
      <ul style="list-style:none; padding:0; margin:0;">
        {#each data.contacts as c}
          <li style="padding:12px; border-top:1px solid var(--border); display:flex; justify-content:space-between; gap:10px;">
            <a href={"/contacts/" + c.id} style="text-decoration:none;">
              {c.name}
            </a>
            <small style="color:var(--muted);">
              {new Date(c.createdAt).toLocaleDateString()}
            </small>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
