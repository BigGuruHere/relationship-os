<script lang="ts">
    // src/routes/contacts/[id]/edit/+page.svelte
    // PURPOSE: Edit a single contact. Prefills with decrypted values passed from the server.
    // SECURITY: No decryption in the browser - we only render strings provided by the server.
    export let data;
    export let form;
  </script>
  
  <div class="container">
    <div class="card" style="padding:20px; max-width:680px; margin: 0 auto;">
      <h1 style="margin-top:0;">Edit contact</h1>
  
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
  
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn primary">Save changes</button>
          <a class="btn" href={'/contacts/' + data.contact.id}>Cancel</a>
        </div>
      </form>
  
      {#if form?.error}
        <p style="color:var(--danger); margin-top:12px;">{form.error}</p>
      {/if}
    </div>
  </div>
  
  <style>
    .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
    .field label { font-size:0.95rem; color:#444; }
    .field input { padding:8px 10px; border:1px solid #ddd; border-radius:8px; }
    .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
    .btn.primary { background:#111; color:#fff; border-color:#111; }
  </style>
  