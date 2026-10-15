<!-- PURPOSE: simple register form that immediately signs in -->
<script lang="ts">
    export let data: { next: string | null };
    export let form;
  </script>
  
  <div class="container" style="max-width:480px;">
    <div class="card" style="padding:22px;">
      <h1 style="margin:0 0 14px 0;">Create account</h1>
  
      {#if form?.error}
        <div class="card" style="padding:10px; margin-bottom:12px; border-color: var(--danger);">
          <div style="color:#ffdada;">{form.error}</div>
        </div>
      {/if}
  
      <form method="POST" action={data.next ? `?next=${encodeURIComponent(data.next)}` : undefined}>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="new-password" required />
        </div>
        <button class="btn primary" type="submit" style="width:100%;">Create account</button>
      </form>
  
      <div style="display:flex; align-items:center; gap:10px; margin:16px 0;">
        <div style="height:1px; background:var(--border); flex:1;"></div>
        <span style="color:var(--muted);">or</span>
        <div style="height:1px; background:var(--border); flex:1;"></div>
      </div>
      <a class="btn" href={data.next ? '/auth/google?next=' + encodeURIComponent(data.next) : '/auth/google'} style="width:100%; justify-content:center;">Continue with Google</a>
      <p style="color:var(--muted); margin-top:14px; font-size:0.95rem;">
        Already have an account? <a href={data.next ? '/auth/login?next=' + encodeURIComponent(data.next) : '/auth/login'}>Sign in</a>
      </p>
    </div>
  </div>
  