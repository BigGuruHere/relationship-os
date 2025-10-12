<script lang="ts">
  // src/routes/contacts/new/+page.svelte
  // PURPOSE: Render the create contact form.
  // SECURITY: No decryption is done here - all data is plain inputs from the user.
  export let form; // SvelteKit enhances this with action results
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:680px; margin: 0 auto;">
    <h1 style="margin-top:0;">Add contact</h1>

    <!-- IT: simple create form. Server validates and encrypts. -->
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

      <!-- IT: new company field - optional -->
      <div class="field">
        <label for="company">Company (optional)</label>
        <input id="company" name="company" placeholder="e.g. ACME Pty Ltd" />
      </div>

      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn primary">Save</button>
        <a class="btn" href="/contacts">Cancel</a>
      </div>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}

    {#if form?.success && form?.contactId}
      <p style="color:var(--success); margin-top:12px;">
        Saved! <a href={"/contacts/" + form.contactId}>Open contact -></a>
      </p>
    {/if}
  </div>
</div>

<style>
  /* Light styling helpers, shared classes assumed to exist in your app.css */
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .field label { font-size:0.95rem; color:#444; }
  .field input { padding:8px 10px; border:1px solid #ddd; border-radius:8px; }
  .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
  .btn.primary { background:#111; color:#fff; border-color:#111; }
</style>
