<!-- src/routes/contacts/new/+page.svelte -->
<!-- PURPOSE: Simple form to create a contact quickly. -->
<script lang="ts">
    export let form; // sveltekit form action data
  </script>
  
  <h1>Add contact</h1>
  
  <form method="post">
    <label>
      Full name<br />
      <input name="fullName" required />
    </label>
    <br />
    <label>
      Email (optional)<br />
      <input name="email" type="email" />
    </label>
    <br />
    <label>
      Phone (optional)<br />
      <input name="phone" />
    </label>
    <br />
    <button type="submit">Save</button>
  </form>
  
  {#if form?.error}
    <p style="color:crimson">{form.error}</p>
  {/if}
  
  {#if form?.success && form?.contactId}
    <p>Saved! <a href={"/contacts/" + form.contactId}>Open contact →</a></p>
  {/if}
  