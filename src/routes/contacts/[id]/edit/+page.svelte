<script lang="ts">
  // src/routes/contacts/[id]/edit/+page.svelte
  // PURPOSE: Edit a single contact. Prefills with decrypted values passed from the server.
  // SECURITY: No decryption in the browser - we only render strings provided by the server.
  export let data;
  export let form;

  // IT: confirm handler to prevent accidental deletes
  function confirmDelete(e: SubmitEvent) {
    const ok = confirm('Delete this contact permanently? This cannot be undone.');
    if (!ok) e.preventDefault();
  }
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:680px; margin: 0 auto;">
    <h1 style="margin-top:0;">Edit contact</h1>

    <!-- IT: update form - posts to the default page action -->
    <form method="post">
      <div class="field">
        <label for="fullName">Full name</label>
        <input id="fullName" name="fullName" required value={data.contact.fullName} />
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value={data.contact.email} />
      </div>

      <div class="field">
        <label for="phone">Phone</label>
        <input id="phone" name="phone" value={data.contact.phone} />
      </div>

      <div class="field">
        <label for="company">Company</label>
        <input id="company" name="company" value={data.contact.company} />
      </div>

      <div class="field">
        <label for="position">Position</label>
        <input id="position" name="position" placeholder="Head of Partnerships" value={form?.values?.position || ''} />
      </div>
      
      <div class="field">
        <label for="linkedin">LinkedIn</label>
        <input id="linkedin" name="linkedin" type="url" inputmode="url" placeholder="https://www.linkedin.com/in/username" value={form?.values?.linkedin || ''} />
        <div class="hint">Paste the full profile url. We normalize it for dedupe.</div>
      </div>

      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn primary">Save changes</button>
        <a class="btn" href={'/contacts/' + data.contact.id}>Cancel</a>
      </div>
    </form>

    <!-- IT: destructive action block - absolute path to avoid relative quirks from /contacts/[id]/edit -->
    <hr style="margin:20px 0;" />

    <form
      method="post"
      action={'/contacts/' + data.contact.id + '/delete'}
      on:submit={confirmDelete}
      style="display:inline-block"
    >
      <button
        type="submit"
        class="btn danger"
        aria-label="Delete contact"
        title="Delete contact"
        style="display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;background:#b00020;color:#fff;border:1px solid #b00020;border-radius:10px;cursor:pointer;"
      >
        Delete
      </button>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
    {/if}
  </div>
</div>

<style>
  /* IT: light styling helpers - shared classes assumed to exist in your app.css */
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .field label { font-size:0.95rem; color:#444; }
  .field input { padding:8px 10px; border:1px solid #ddd; border-radius:8px; }
  .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
  .btn.primary { background:#111; color:#fff; border-color:#111; }
  .btn.danger { background:#b00020; color:#fff; border-color:#b00020; }
</style>
