<!-- src/routes/+layout.svelte
     PURPOSE:
     - Provide a responsive shell
     - Show Login or Logout based on data.user
-->

<script lang="ts">
    import "../app.css"; // ensure global styles load
    export let data: { user: { id: string; email: string } | null; reconnectDue: number };
  </script>
  
  <div class="layout">
    <!-- Mobile topbar -->
<!-- Mobile topbar -->
<header class="topbar mobile-only">
  <a class="brand" href="/" aria-label="Relish home">
    <div class="logo">
      <img src="/relish-logo.png" alt="Relish logo" width="28" height="28" />
    </div>
    <div>Relish</div>
  </a>

  <!-- Compact mobile actions - icons prevent overflow on small phones -->
  <nav class="topbar-actions" aria-label="Primary">
    <!-- Contacts -->
    <a class="btn icon" href="/" aria-label="Contacts">
      <span class="btn-icon" aria-hidden="true">📇</span>
    </a>

    <!-- Search -->
    <a class="btn icon" href="/search" aria-label="Search">
      <span class="btn-icon" aria-hidden="true">🔎</span>
    </a>

      <!-- Add Contact - keep visible on mobile -->
      <a class="btn primary icon" href="/contacts/new" aria-label="Add Contact">
        <span class="btn-icon" aria-hidden="true">➕</span>
      </a>

      {#if data.user}
      <div class="nav-right">
        <a href="/reconnect" class="btn">
          Reconnect
          {#if data.reconnectDue > 0}
            <span class="pill">{data.reconnectDue}</span>
          {/if}
        </a>
        <form method="post" action="/auth/logout">
          <button class="btn">Logout</button>
        </form>
      </div>

    {/if}

<!-- back to login -->
<form method="POST" action="/auth/logout?redirect=/auth/login">
  <button class="btn primary icon" type="submit" aria-label="Logout">
    <span class="btn-icon" aria-hidden="true">
      <!-- simple black and white logout icon - inherits currentColor -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
           width="18" height="18" fill="currentColor">
        <path d="M3 3h12v2H5v14h10v2H3V3z"/>
        <path d="M13 12l5-5v3h6v4h-6v3l-5-5z"/>
      </svg>
    </span>
  </button>
</form>

<!-- or, back to home -->
<!-- <form method="POST" action="/auth/logout?redirect=/"> ... </form> -->


      
      

      <!-- More menu groups the less used item to avoid overflow -->
  

  </nav>
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
          {#if data.user}
          <div class="nav-right">
            <a href="/reconnect" class="btn">
              Reconnect
              {#if data.reconnectDue > 0}
                <span class="pill">{data.reconnectDue}</span>
              {/if}
            </a>
            <form method="post" action="/auth/logout">
              <button class="btn">Logout</button>
            </form>
          </div>
        {/if}
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

  <style>
    .btn.icon {
  width: 44px;       /* or match the average text button width */
  height: 40px;      /* same vertical height */
  justify-content: center;
  padding: 0;        /* center icon without extra padding */
}

/* Keep the logout form inline so it looks like a button in the row */
.topbar-actions form {
  display: inline-flex;   /* comment: aligns with other .btn items */
  margin: 0;              /* comment: remove default margins */
}

.topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-1);
  }
  .brand { font-weight: 600; text-decoration: none; color: var(--text); }
  .nav-right { display: flex; align-items: center; gap: 8px; }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
  }
  .btn:hover { background: var(--surface-3); }
  .pill {
    display: inline-block;
    min-width: 20px;
    padding: 2px 6px;
    border-radius: 9999px;
    font-size: 12px;
    text-align: center;
    background: #e5f4ff;
    color: #0369a1;
    border: 1px solid #bae6fd;
  }

  </style>
  