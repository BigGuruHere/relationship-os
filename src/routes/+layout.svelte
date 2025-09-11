<!-- src/routes/+layout.svelte
     PURPOSE:
     - Provide a responsive shell:
       * Mobile: top navigation bar
       * Desktop: left sidebar
       * Footer at the bottom
     - Slot renders the current page inside the main content area.
-->

<script lang="ts">
    import "../app.css"; // ensure global styles load
  </script>
  
  <div class="layout">
    <!-- Mobile topbar (hidden on desktop) -->
    <header class="topbar mobile-only">
      <div class="brand">
        <div class="logo">✺</div>
        <div>Relationship OS</div>
      </div>
      <div style="margin-left:auto; display:flex; gap:8px;">
        <!-- simple top links for mobile -->
        <a class="btn" href="/">Home</a>
        <a class="btn primary" href="/contacts/new">Add Contact</a>
      </div>
    </header>
  
    <!-- Desktop sidebar -->
    <aside class="sidebar desktop-only">
      <div class="brand" style="margin-bottom:4px;">
        <div class="logo">✺</div>
        <div>Relationship OS</div>
      </div>
  
      <nav class="nav-group">
        <a class="nav-link" href="/">🏠 Home</a>
        <a class="nav-link" href="/contacts/new">➕ Add Contact</a>
        <!-- Add more when you have them -->
        <!-- <a class="nav-link" href="/search">🔎 Search</a> -->
        <!-- <a class="nav-link" href="/tasks">🗓 Tasks</a> -->
      </nav>
  
      <div class="card" style="padding:12px; margin-top:auto;">
        <!-- small “tip” card -->
        <div style="font-weight:600; margin-bottom:6px;">Quick tip</div>
        <div style="color:var(--muted); font-size:0.95rem;">
          Add a contact, then attach a note. We’ll add voice notes later.
        </div>
      </div>
    </aside>
  
    <!-- Main content -->
    <main class="main">
      <slot />
    </main>
  
    <!-- Footer (visible on all sizes) -->
    <footer class="footer">
      <div class="container" style="display:flex; align-items:center; gap:12px; justify-content:space-between;">
        <div>© {new Date().getFullYear()} Relationship OS</div>
        <div style="display:flex; gap:10px;">
          <a href="/" aria-label="Home">Home</a>
          <span aria-hidden="true">·</span>
          <a href="/contacts/new" aria-label="Add Contact">Add Contact</a>
        </div>
      </div>
    </footer>
  </div>
  