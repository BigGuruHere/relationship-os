<script lang="ts">
    // src/routes/u/[slug]/lead/+page.svelte
    // PURPOSE: visitor form so a guest can share their details with the profile owner
    // SECURITY: posts to server action - no client crypto or secrets here
    export let data;
    export let form;
  
    // IT: owner display name comes from +page.server.ts load result
    const ownerName = data?.owner?.name || 'this contact';
  
    // IT: simple phone sanity pattern - digits, spaces and common symbols, at least 7 chars
    // - deliberately permissive for international formats
    const phonePattern = '^[0-9()+\\-\\s]{7,}$';
  
    // IT: preserve previously entered values from the server provided `form.values`
    const v = form?.values || {};
    const errors = form?.errors || {};
  </script>
  
  <div class="container">
    <div class="card page" style="padding:16px; max-width:720px; margin:0 auto;">
      <h1 class="title">Share your details with {ownerName}</h1>
      <p class="muted" style="margin:6px 0 16px 0;">
        We will share your details with {ownerName} so you can stay in touch.
      </p>
  
      <!-- IT: POST to the named action `create` so it hits actions.create in +page.server.ts -->
      <form method="post" action="?/create" class="form" novalidate>
        <div class="field">
          <label for="name">Name</label>
          <input
            id="name"
            name="name"
            required
            value={v.name ?? ''}
            aria-invalid={errors?.name ? 'true' : 'false'}
            aria-describedby={errors?.name ? 'err-name' : undefined}
          />
          {#if errors?.name}
            <p id="err-name" class="error">{errors.name}</p>
          {/if}
        </div>
  
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            inputmode="email"
            autocomplete="email"
            value={v.email ?? ''}
            aria-invalid={errors?.email ? 'true' : 'false'}
            aria-describedby={errors?.email ? 'err-email' : undefined}
          />
          {#if errors?.email}
            <p id="err-email" class="error">{errors.email}</p>
          {/if}
        </div>
  
        <div class="field">
          <label for="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            inputmode="tel"
            autocomplete="tel"
            pattern={phonePattern}
            title="Please enter a valid phone number"
            value={v.phone ?? ''}
            aria-invalid={errors?.phone ? 'true' : 'false'}
            aria-describedby={errors?.phone ? 'err-phone' : undefined}
          />
          {#if errors?.phone}
            <p id="err-phone" class="error">{errors.phone}</p>
          {/if}
        </div>
  
        {#if form?.error}
          <p class="error">{form.error}</p>
        {/if}
  
        <div class="btnrow">
          <button class="btn primary" type="submit">Send details</button>
          <!-- IT: Cancel sends to a friendly page instead of the public profile -->
          <a class="btn" href={"/no-problem?ref=" + encodeURIComponent(data?.owner?.slug || '')}>Cancel</a>
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
    .error { color:#c00; font-size:0.95rem; margin:2px 0 0 0; }
  </style>
  