<script lang="ts">
  // PURPOSE: Render the create contact form.
  // SECURITY: No decryption is done here - all data is plain inputs from the user.
  import { enhance } from '$app/forms'; // IT: use enhance so redirects are handled smoothly
  export let form; // IT: SvelteKit enhances this with action results
</script>

<div class="container">
  <div class="card" style="padding:20px; max-width:680px; margin: 0 auto;">
    <h1 style="margin-top:0;">Add contact</h1>

    <!-- IT: simple create form. Server validates and encrypts. -->
    <form method="post" action="?/create">
      <div class="field">
        <label for="fullName">Full name</label>
        <input id="fullName" name="fullName" required />
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" />
      </div>

      <div class="field">
        <label for="phone">Phone</label>
        <input id="phone" name="phone" />
      </div>

      <!-- IT: new company field - optional -->
      <div class="field">
        <label for="company">Company</label>
        <input id="company" name="company" placeholder="e.g. ACME Pty Ltd" />
      </div>

      <div class="field">
        <label for="position">Position</label>
        <input id="position" name="position" placeholder="Head of Partnerships" value={form?.values?.position || ''} />
      </div>
      
      <div class="field">
        <label for="linkedin">LinkedIn</label>
        <input id="linkedin" name="linkedin" type="url" inputmode="url" placeholder="https://www.linkedin.com/in/username" value={form?.values?.linkedin || ''} />
      </div>

      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn primary">Save</button>
        <a class="btn" href="/contacts">Cancel</a>
      </div>
    </form>

    {#if form?.error}
      <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
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
