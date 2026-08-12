<!-- PURPOSE: simple register form that immediately signs in -->
<script lang="ts">
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
  
      <form method="POST">
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
  
      <p style="color:var(--muted); margin-top:14px; font-size:0.95rem;">
        Already have an account? <a href="/auth/login">Sign in</a>
      </p>
    </div>
  </div>
  