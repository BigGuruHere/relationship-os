<!-- PURPOSE: simple login form with Google option -->
<script lang="ts">
    export let form; // SvelteKit action form data
  </script>
  
  <div class="container" style="max-width:480px;">
    <div class="card" style="padding:22px;">
      <h1 style="margin:0 0 14px 0;">Sign in</h1>
  
      {#if form?.error}
        <div class="card" style="padding:10px; margin-bottom:12px; border-color: var(--danger);">
          <div style="color:#ffdada;">{form.error}</div>
        </div>
      {/if}
  
      <form method="POST">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button class="btn primary" type="submit" style="width:100%;  justify-content:center;">Sign in</button>
      </form>
  
      <div style="display:flex; align-items:center; gap:10px; margin:16px 0;">
        <div style="height:1px; background:var(--border); flex:1;"></div>
        <div style="color:var(--muted); font-size:0.9rem;">or</div>
        <div style="height:1px; background:var(--border); flex:1;"></div>
      </div>
  
      <a class="btn" href="/auth/google" style="width:100%; justify-content:center;">
        Continue with Google
      </a>
  
      <p style="color:var(--muted); margin-top:14px; font-size:0.95rem;">
        No account? <a href="/auth/register">Create one</a>
      </p>
    </div>
  </div>
  