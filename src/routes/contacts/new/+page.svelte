<script lang="ts">
  // src/routes/contacts/new/+page.svelte
  export let form;
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:680px; margin: 0 auto;">
    <h1 style="margin-top:0;">Add contact</h1>

    <form method="post">
      <div class="field">
        <label for="fullName">Full name</label>
        <input id="fullName" name="fullName" required />
      </div>

      <div class="field">
        <label for="email">Email (optional)</label>
        <input id="email" name="email" type="email" />
      </div>

      <div class="field">
        <label for="phone">Phone (optional)</label>
        <input id="phone" name="phone" />
      </div>

      <div style="display:flex; gap:10px;">
        <button class="btn primary" type="submit">Save</button>
        <a class="btn" href="/">Cancel</a>
      </div>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}

    {#if form?.success && form?.contactId}
      <p style="color:var(--success); margin-top:12px;">
        Saved! <a href={"/contacts/" + form.contactId}>Open contact →</a>
      </p>
    {/if}
  </div>
</div>
