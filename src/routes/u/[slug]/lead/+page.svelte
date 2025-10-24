<script lang="ts">
    // src/routes/u/[slug]/lead/+page.svelte
    // PURPOSE: visitor form so a guest can share their details with the profile owner
    // SECURITY: posts to server action - no client crypto or secrets here
    export let data;
    export let form;
  
    // IT: owner display name comes from +page.server.ts load result
    const ownerName = data?.owner?.name || 'this contact';
  </script>
  
  <div class="container">
    <div class="card page" style="padding:16px; max-width:720px; margin:0 auto;">
      <h1 class="title">Share your details with {ownerName}</h1>
      <p class="muted" style="margin:6px 0 16px 0;">
        We will share your details with {ownerName} so you can stay in touch.
      </p>
  
      <!-- IT: POST to the named action `create` so it hits actions.create in +page.server.ts -->
      <form method="post" action="?/create" class="form">
        <div class="field">
          <label for="name">Name</label>
          <input id="name" name="name" required />
        </div>
  
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" />
        </div>
  
        <div class="field">
          <label for="phone">Phone</label>
          <input id="phone" name="phone" type="tel" />
        </div>
  
        {#if form?.error}
          <p class="error">{form.error}</p>
        {/if}
  
        <div class="btnrow">
          <button class="btn primary" type="submit">Send details</button>
          <a class="btn" href={"/u/" + encodeURIComponent(data?.owner?.slug || "")}>Cancel</a>
        </div>
      </form>
    </div>
  </div>
  
  <style>
    /* IT: light styles aligned with the rest of the app */
    .title { margin:0; font-size:1.25rem; font-weight:600; }
    .muted { color:#666; }
    .form { display:grid; gap:12px; max-width:420px; }
    .field { display:flex; flex-direction:column; gap:6px; }
    .field input { padding:8px 10px; border:1px solid #ddd; border-radius:10px; }
    .btnrow { display:flex; gap:8px; margin-top:6px; }
    .btn {
      display:inline-flex; align-items:center; justify-content:center;
      height:36px; padding:0 12px; border:1px solid #ccc; border-radius:10px;
      text-decoration:none; background:#fff; color:inherit; line-height:1; cursor:pointer;
    }
    .btn.primary { background:#111; color:#fff; border-color:#111; }
    .error { color:#c00; font-size:0.95rem; }
  </style>
  