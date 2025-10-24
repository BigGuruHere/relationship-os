<script lang="ts">
  // src/routes/thank-you/+page.svelte
  // PURPOSE: post-share confirmation screen that onboards the visitor to create a free profile or try the app
  // SECURITY: purely presentational - uses only data provided by the server load
  export let data;

  // IT: friendly name for the sharer to show in the headline
  const sharerName: string = data?.sharerName || 'your new contact';

  // IT: routes for calls to action
  const createProfileHref = '/register';       // IT: your existing register route
  const appHomeHref = '/';                     // IT: fallback exploration link
</script>

<div class="wrap">
  <div class="card">
    <h1 class="title">You are now connected with {sharerName}</h1>
    <p class="lead">
      We have shared your details successfully.
    </p>

    <div class="cta">
      <a class="btn primary" href={createProfileHref}>Create your free profile</a>
      <a class="btn" href={appHomeHref}>Explore the app</a>
    </div>

    <p class="small">
      Create a simple share link so others can save your details in one tap. You can add your photo, headline, and links, then upgrade later to use the personal CRM features.
    </p>
  </div>
</div>

<style>
  /* IT: simple, clean styling consistent with your app button styles */
  .wrap {
    max-width: 720px;
    margin: 40px auto;
    padding: 0 16px;
  }
  .card {
    border: 1px solid #eceef1;
    border-radius: 12px;
    padding: 20px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .title {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  .lead {
    margin: 0 0 16px 0;
    color: #444;
  }
  .cta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 6px 0 12px 0;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 12px;
    border: 1px solid #ccc;
    border-radius: 10px;
    text-decoration: none;
    background: #fff;
    color: inherit;
    line-height: 1;
    cursor: pointer;
  }
  .btn.primary {
    background: #111;
    color: #fff;
    border-color: #111;
  }
  .small {
    color: #666;
    font-size: 0.95rem;
    margin: 0;
  }
</style>
