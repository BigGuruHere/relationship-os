<!-- src/routes/+layout.svelte
     PURPOSE:
     - Provide a responsive shell
     - Show Login or Logout based on data.user
     - Use black and white icon buttons in the topbar for primary actions
-->

<script lang="ts">
  import "../app.css"; // ensure global styles load
  export let data: { user: { id: string; email: string } | null; reconnectDue: number; remindersOpenCount: number };
</script>

<div class="layout">
  <!-- Mobile topbar -->
  <header class="topbar mobile-only">
    <a class="brand" href="/" aria-label="Relish home">
      <div class="logo">
        <img src="/relish-logo.png" alt="Relish logo" />
      </div>
    </a>
    

    <!-- Compact mobile actions - icon only for a tidy topbar -->
    <nav class="topbar-actions" aria-label="Primary">
      <!-- Contacts -->
     <!-- address book icon 

      <a class="btn icon" href="/" aria-label="Contacts">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4V3zM2 6h1v2H2V6zm0 4h1v2H2v-2zm0 4h1v2H2v-2z"/>
          <circle cx="12" cy="9" r="2"/>
          <path d="M7.5 16a4.5 4.5 0 0 1 9 0H7.5z"/>
        </svg>
      </a>
      -->

      <!-- Search -->
      <a class="btn icon" href="/search" aria-label="Search">
        <!-- magnifier icon -->
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10 4a6 6 0 1 1 0 12A6 6 0 0 1 10 4zm8.707 13.293-3.4-3.4A8 8 0 1 0 11 20a7.96 7.96 0 0 0 4.893-1.693l3.4 3.4 1.414-1.414z"/>
        </svg>
      </a>

      <!-- Add Contact -->
      <a class="btn icon" href="/contacts/new" aria-label="Add Contact" title="Add Contact">
        <!-- user plus icon -->
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"/>
          <path d="M12 14c-4 0-7 2-7 4v2h8.5v-2c0-.7.2-1.4.6-2 .5-.8 1.3-1.4 2.3-1.8A9.7 9.7 0 0 0 12 14z"/>
          <path d="M19 10v-3h-2v3h-3v2h3v3h2v-3h3v-2z"/>
        </svg>
      </a>

      {#if data.user}
        <!-- Reconnect -->
        <a class="btn icon" href="/reconnect" aria-label="Reconnect" title="Reconnect">
          <!-- refresh loop icon -->
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V8a5 5 0 1 1-4.9 6h-2.1A7 7 0 1 0 17.65 6.35z"/>
          </svg>
          {#if data.reconnectDue > 0}
            <span class="pill">{data.reconnectDue}</span>
          {/if}
        </a>

        <!-- Reminders -->
        <a class="btn icon" href="/reminders" aria-label="Reminders" title="Reminders">
          <!-- bell icon -->
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z"/>
            <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z"/>
          </svg>
          {#if data.remindersOpenCount > 0}
            <span class="pill">{data.remindersOpenCount}</span>
          {/if}
        </a>

        <!-- In src/routes/+layout.svelte header actions -->
        <a class="icon-btn" href="/share" aria-label="Share your link" title="Share your link">
          <!-- Simple share icon SVG - monochrome -->
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 3 3zM6 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm12 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.59 13.05l6.83-3.42.9 1.8-6.83 3.43-.9-1.81z" fill="currentColor" />
          </svg>
        </a>



        <!-- Logout -->
        <form method="POST" action="/auth/logout?redirect=/auth/login" class="inline-form" aria-label="Logout">
          <button class="btn icon" type="submit" aria-label="Logout" title="Logout">
            <!-- logout icon -->
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 3h12v2H5v14h10v2H3V3z"/>
              <path d="M13 12l5-5v3h6v4h-6v3l-5-5z"/>
            </svg>
          </button>
        </form>
      {:else}
        <!-- Login -->
        <a class="btn icon" href="/auth/login" aria-label="Login" title="Login">
          <!-- key icon -->
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 14a5 5 0 1 1 4.9-6h10.1v4h-2v2h-2v2h-4v-2H11.9A5 5 0 0 1 7 14zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
          </svg>
        </a>
      {/if}
    </nav>
  </header>

  <!-- Desktop sidebar - unchanged text links plus existing blocks -->
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

        <div class="nav-right" style="margin:6px 0;">
          <a href="/reconnect" class="btn">
            Reconnect
            {#if data.reconnectDue > 0}
              <span class="pill">{data.reconnectDue}</span>
            {/if}
          </a>
          <a href="/reminders" class="btn">
            Reminders
            {#if data.remindersOpenCount > 0}
              <span class="pill">{data.remindersOpenCount}</span>
            {/if}
          </a>
        </div>

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

  <!-- Footer - links only on mobile -->
  <footer class="footer">
    <div class="container" style="display:flex; align-items:center; gap:12px; justify-content:space-between;">
      <div>© {new Date().getFullYear()} Relationship OS</div>
      <div class="mobile-only footer-links">
        <a href="/" aria-label="Home">Contacts</a>
        <span aria-hidden="true">·</span>
        {#if !data.user}
          <a href="/auth/login" aria-label="Login">Login</a>
        {/if}
      </div>
    </div>
  </footer>
</div>

<style>
  /* One place to control icon and button sizing */
/* One place to tune sizes */
:root {
  --icon-size: 24px;        /* icons */
  --icon-button-w: 48px;
  --icon-button-h: 44px;

  --logo-size: 60px;        /* logo - set this to your desired size */
  --brand-gap: 8px;         /* gap between logo and text */
}

.logo img {
  width: var(--logo-size);
  height: var(--logo-size);
  object-fit: contain;       /* keeps aspect ratio tidy */
}


/* Apply the variables */
.btn.icon {
  width: var(--icon-button-w);
  height: var(--icon-button-h);
  justify-content: center;
  padding: 0;
}

.btn.icon svg {
  /* make inline SVGs follow the global size */
  width: var(--icon-size);
  height: var(--icon-size);
}


  /* Icon button sizing - keeps a tidy row on small screens */
  .btn.icon {
    width: 44px;
    height: 40px;
    justify-content: center;
    padding: 0;
    position: relative; /* allows pill positioning if needed later */
  }

  /* Keep the logout form inline so it looks like a button in the row */
  .inline-form {
    display: inline-flex;
    margin: 0;
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
  .topbar-actions { display: inline-flex; align-items: center; gap: 8px; }
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


/* Topbar layout - make brand take the leftover space, actions stay compact */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-1);
  box-sizing: border-box; /* ensure padding does not clip content */
}

.topbar .brand {
  /* Comment: brand expands but can shrink without overlapping actions */
  display: flex;
  align-items: center;
  gap: var(--brand-gap);
  flex: 1 1 auto;
  min-width: 0; /* allow text to truncate instead of pushing icons off */
  text-decoration: none;
  color: var(--text);
}

.topbar .topbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto; /* keep actions fixed - no shrinking */
}

/* Logo box - remove phantom spacing and fit exactly */
.logo {
  width: var(--logo-size);
  height: var(--logo-size);
  padding: 0;
  margin: 0;
  line-height: 0;           /* kill inline image baseline gap */
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.logo img {
  width: 100%;
  height: 100%;
  display: block;           /* no extra bottom whitespace */
  object-fit: contain;      /* keep aspect ratio */
}





/* Icon buttons - use the shared size variables */
.btn.icon {
  width: var(--icon-button-w);
  height: var(--icon-button-h);
  justify-content: center;
  padding: 0;
}

.btn.icon svg {
  width: var(--icon-size);
  height: var(--icon-size);
}

/* Generic button styles */
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

/* Pills unchanged */
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

.icon-btn { display:inline-flex; align-items:center; justify-content:center; padding:8px; border-radius:10px; border:1px solid #ddd; text-decoration:none; }

</style>
