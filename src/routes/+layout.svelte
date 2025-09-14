<!-- src/routes/+layout.svelte
     PURPOSE:
     - Provide a responsive shell
     - Show Login or Logout based on data.user
-->

<script lang="ts">
    import "../app.css"; // ensure global styles load
    export let data: { user: { id: string; email: string } | null };
  </script>
  
  <div class="layout">
    <!-- Mobile topbar -->
    <header class="topbar mobile-only">
      <a class="brand" href="/" aria-label="Relish home">
        <div class="logo">
          <img src="/relish-logo.png" alt="Relish logo" width="28" height="28" />
        </div>
        <div>Relish</div>
      </a>
    
      <!-- add a class so we can style it cleanly -->
      <div class="topbar-actions">
        <a class="btn" href="/">Contacts</a>
        <a class="btn" href="/search">Search</a>
        {#if data.user}
          <a class="btn primary" href="/contacts/new">Add Contact</a>
          <form method="POST" action="/auth/logout">
            <button class="btn" type="submit">Logout</button>
          </form>
        {:else}
          <a class="btn" href="/auth/login">Login</a>
          <a class="btn" href="/auth/register">Register</a>
        {/if}
      </div>
    </header>
    
  
    <!-- Desktop sidebar -->
    <aside class="sidebar desktop-only">
      <a class="brand" href="/" aria-label="Relish home">
        <div class="logo">
          <img src="/relish-logo.png" alt="Relish logo" width="28" height="28" />
        </div>
        <div>Relish</div>
      </a>

  
      <nav class="nav-group">
        <a class="nav-link" href="/">📇 Contacts</a>
        <a class="nav-link" href="/search">🔎 Search</a>
        {#if data.user}
          <a class="nav-link" href="/contacts/new">➕ Add Contact</a>
          <form method="POST" action="/auth/logout">
            <button class="btn" type="submit" style="width:100%;">Logout</button>
          </form>
          <div class="card" style="padding:10px;">
            <div style="font-size:0.9rem; color:var(--muted);">Signed in as</div>
            <div style="font-weight:600; word-break:break-all;">{data.user.email}</div>
          </div>
        {:else}
          <a class="nav-link" href="/auth/login">🔑 Login</a>
          <a class="nav-link" href="/auth/register">🆕 Register</a>
        {/if}
      </nav>
  
      <div class="card" style="padding:12px; margin-top:auto;">
        <div style="font-weight:600; margin-bottom:6px;">Quick tip</div>
        <div style="color:var(--muted); font-size:0.95rem;">
          Add a contact, then attach a note. Voice notes are supported.
        </div>
      </div>
    </aside>
  
    <!-- Main content -->
    <main class="main">
      <slot />
    </main>
  
    <!-- Footer -->
<!-- Footer - links only on mobile -->
<!-- Footer - links only on mobile -->
<!-- links only on mobile - no inline display styles -->
<footer class="footer">
  <div class="container" style="display:flex; align-items:center; gap:12px; justify-content:space-between;">
    <div>© {new Date().getFullYear()} Relationship OS</div>

    <!-- use both classes so we can style and hide correctly -->
    <div class="mobile-only footer-links">
      <a href="/" aria-label="Home">Contacts</a>
      <span aria-hidden="true">·</span>
      {#if data.user}
        <a href="/contacts/new" aria-label="Add Contact">Add Contact</a>
      {:else}
        <a href="/auth/login" aria-label="Login">Login</a>
      {/if}
    </div>
  </div>
</footer>



  </div>
  