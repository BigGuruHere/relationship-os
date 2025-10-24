<script lang="ts">
    // src/routes/no-problem/+page.svelte
    // PURPOSE: friendly screen when a visitor cancels sharing their details
    // SECURITY: presentational only - no secrets
    import { page } from '$app/stores';
  
    $: ref = $page.url.searchParams.get('ref') || '';
    const sharer = ref ? ref.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'your new contact';
  </script>
  
  <div class="wrap">
    <div class="card">
      <h1 class="title">No problem</h1>
      <p class="lead">You did not share your details this time. You can still explore the app and create your own profile later.</p>
      <div class="cta">
        <a class="btn primary" href="/">Explore the app</a>
      </div>
      <p class="small">You can come back to connect with {sharer} any time.</p>
    </div>
  </div>
  
  <style>
    .wrap { max-width: 720px; margin: 40px auto; padding: 0 16px; }
    .card { border: 1px solid #eceef1; border-radius: 12px; padding: 20px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .title { margin: 0 0 8px 0; font-size: 1.25rem; font-weight: 600; }
    .lead { margin: 0 0 16px 0; color: #444; }
    .cta { display: flex; gap: 10px; flex-wrap: wrap; margin: 6px 0 12px 0; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 12px; border: 1px solid #ccc; border-radius: 10px; text-decoration: none; background: #fff; color: inherit; line-height: 1; cursor: pointer; }
    .btn.primary { background: #111; color: #fff; border-color: #111; }
    .small { color: #666; font-size: 0.95rem; margin: 0; }
  </style>
  