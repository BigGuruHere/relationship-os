<script lang="ts">
    // src/routes/guest/welcome/+page.svelte
    // PURPOSE: minimal guest landing with a clear next step and a friendly message
    //          that shows who they are connecting with when available.
    export let data;
  </script>
  
  <div class="container">
    <div class="card" style="padding:16px; max-width:520px; margin:0 auto;">
      <h1 style="margin:0 0 12px 0;">You are in</h1>
  
      {#if data.owner?.slug}
        <p style="color:#444;">
          You are connecting with
          <a class="link" href={"/u/" + data.owner.slug}>/u/{data.owner.slug}</a>.
        </p>
      {:else if data.owner?.id}
        <p style="color:#444;">
          You are connecting with this host. If you see a public link from them, you can open it any time.
        </p>
      {:else}
        <p style="color:#444;">
          This is a temporary guest view. Use the public link to share your details and get a magic link.
        </p>
      {/if}
  
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
        {#if data.owner?.slug}
          <!-- If we know the slug, link back to the public page so they can share details -->
          <a class="btn primary" href={"/u/" + data.owner.slug}>Back to public page</a>
        {/if}
        <a class="btn" href="/share">Get your own share link</a>
      </div>
  
      <p style="color:#666; font-size:0.9rem; margin-top:12px;">
        Tip - on the public page, use Share your details to receive a magic link by email or SMS. That makes it easy to return without a password.
      </p>
    </div>
  </div>
  
  <style>
    .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
    .btn.primary { background:#111; color:#fff; border-color:#111; }
  </style>
  