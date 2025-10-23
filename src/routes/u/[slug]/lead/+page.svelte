<script lang="ts">
    // PURPOSE: tiny lead form that creates a Contact for the owner
    export let data;
  </script>
  
  <div class="container">
    <div class="card" style="padding:16px; max-width:520px; margin:0 auto;">
      <h1 style="margin:0 0 10px 0;">Share your details</h1>
      <form method="post" action="?/create">
        <input type="hidden" name="ownerId" value={data.owner.id} />
        <div class="field"><label for="name">Name</label><input id="name" name="name" required /></div>
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" /></div>
        <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" /></div>
        <div style="display:flex; gap:8px; margin-top:10px;">
          <button class="btn primary">Send</button>
          <a class="btn" href={'/u/' + data.owner.slug}>Cancel</a>
        </div>
      </form>
    </div>
  </div>
  
  <style>
    .field { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
    .field input { padding:8px 10px; border:1px solid #ddd; border-radius:10px; }
    .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
    .btn.primary { background:#111; color:#fff; border-color:#111; }
  </style>
  