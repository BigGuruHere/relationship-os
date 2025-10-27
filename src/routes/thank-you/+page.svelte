<script lang="ts">
  // src/routes/thank-you/+page.svelte
  // PURPOSE: post-share confirmation screen that now only offers an Explore the app CTA
  // SECURITY: purely presentational - uses only data provided by the server load
  export let data;

  // IT: friendly name for the sharer to show in the headline
  const sharerName: string = data?.sharerName || 'your new contact';

  // IT: single CTA - explore the app
  const appHomeHref = '/';
</script>

<div class="wrap">
  <div class="card">
    <h1 class="title">You are now connected with {sharerName}</h1>
    <p class="lead">
      We have shared your details successfully.
    </p>

    <!-- For possible future use -->
    <!--  On /thank-you page - optional, off by default -->
<!-- PURPOSE: let a viewer paste their LinkedIn to help you stay in touch -->
<!-- SECURITY: server normalizes and indexes the URL - no plaintext matching -->

{#if false /* flip to true when testing */ }
<form method="post" action="/api/guest/claim-linkedin" class="card" style="margin-top:12px; padding:12px;">
  <label for="li">Your LinkedIn</label>
  <input id="li" name="linkedinUrl" placeholder="https://www.linkedin.com/in/your-handle" />
  <button class="btn primary" type="submit">Share LinkedIn</button>
</form>
{/if}

    <!-- IT: single CTA left - explore the app -->
    <div class="cta">
      <a class="btn primary" href={appHomeHref}>Explore the app</a>
    </div>

    <p class="small">
      You can create your own profile from inside the app any time.
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
