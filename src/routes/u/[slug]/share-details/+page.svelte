<script lang="ts">
  // IT: Reuse the protected capture route for steps two and three, with no account required.
  export let data;
  export let form: any;
  $: createStep = Boolean(form?.shared || data.createStep);
  $: canClaim = Boolean(form?.canClaim || data.canClaim);
  $: draft = form?.values || { name: '', email: '', phone: '' };
  $: profileUrl = '/u/' + encodeURIComponent(data.profile.slug) + '?original=1';
</script>

<svelte:head>
  <title>{createStep ? 'Your own Relish profile' : 'Share your details'} - Relish</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="capture-page">
  <nav aria-label="Contact exchange">
    <a href={profileUrl}>{createStep ? 'Close' : 'Back'}</a>
    <span>Relish</span>
    {#if !createStep}<a href={'/u/' + encodeURIComponent(data.profile.slug) + '/share-details?step=create'}>Skip</a>{/if}
  </nav>
  {#if data.ownedFlow}
    <section class="capture-card">
      <h1>Share my details back</h1>
      <p>Choose a profile to share with {data.profile.name}. Confirming saves each person's shared details in the other's My People.</p>
      {#if form?.error}<p role="alert">{form.error}</p>{/if}
      {#each data.choices as choice}
        <article class="profile-preview preview-body">
          <h2>{choice.label}</h2><p>{choice.name}</p>
          {#if choice.email}<p>{choice.email}</p>{/if}
          {#if choice.phone}<p>{choice.phone}</p>{/if}
          <form method="POST"><input type="hidden" name="intent" value="confirm-profile" /><input type="hidden" name="confirmation" value={choice.confirmation} /><button class="primary">Confirm exchange with {data.profile.name}</button></form>
        </article>
      {/each}
      <form method="POST"><input type="hidden" name="intent" value="new-exchange-profile" /><button class="primary">Create a new profile</button></form>
      <a class="later" href={profileUrl}>Continue later</a>
    </section>
  {:else if createStep}
    <!-- IT: Successful sharing and skipping both finish here. Signup is an independent choice. -->
    {#if form?.shared}<p class="receipt" role="status">Your details have been shared with {data.profile.name}.</p>{/if}
    <section class="capture-card" aria-labelledby="create-heading">
      <p class="eyebrow">Stay in touch</p>
      <h1 id="create-heading">Your next introduction starts here.</h1>
      <p>Create your own Relish profile to share your details and remember the people you meet.</p>
      <article class="profile-preview" aria-label="Your profile preview">
        <div class="preview-cover" aria-hidden="true">{draft.name ? draft.name.charAt(0).toUpperCase() : 'R'}</div>
        <div class="preview-body">
          <span class="eyebrow">Preview - only you can see this</span>
          <h2>{draft.name || 'Your name'}</h2>
          <p>{draft.email || 'Add your email'}</p>
          <p>{draft.phone || 'Add your phone number'}</p>
        </div>
      </article>
      {#if canClaim}
        <form method="POST"><input type="hidden" name="intent" value="create-profile" /><input type="hidden" name="name" value={draft.name} /><input type="hidden" name="email" value={draft.email} /><input type="hidden" name="phone" value={draft.phone} /><button class="primary">{data.isSignedIn ? 'Verify and save contact' : 'Create my profile and keep this contact'}</button></form>
      {:else if data.isSignedIn}
        <a class="primary" href="/profiles">Go to My Profiles</a>
      {:else}
        <!-- SECURITY: Draft details travel in a POST, then an encrypted HttpOnly cookie, never a URL. -->
        <form method="POST">
          <input type="hidden" name="intent" value="create-profile" />
          <input type="hidden" name="name" value={draft.name} />
          <input type="hidden" name="email" value={draft.email} />
          <input type="hidden" name="phone" value={draft.phone} />
          <button class="primary" type="submit">Create my Relish profile</button>
        </form>
      {/if}
      <p class="hint">You'll review your details before publishing. Creating an account is optional.</p>
      <a class="later" href={profileUrl}>Maybe later</a>
    </section>
  {:else}
    <section class="capture-card" aria-labelledby="capture-heading">
      {#if data.profile.avatarUrl}<img class="avatar" src={data.profile.avatarUrl} alt="" width="64" height="64" />{/if}
      {#if data.canSignIn}<form method="POST"><input type="hidden" name="intent" value="signin-exchange" /><button class="primary">Already use Relish? Sign in to choose a profile</button></form>{/if}
      <h1 id="capture-heading">Share your details with {data.profile.name}</h1>
      <p>Let {data.profile.name} save your details privately and follow up after meeting you.</p>
      <form method="POST">
        <input type="hidden" name="captureToken" value={data.captureToken} />
        <label for="capture-name">Your name</label>
        <input id="capture-name" name="name" autocomplete="name" maxlength="200" required value={form?.values?.name || ''} />
        <label for="capture-email">Email (optional)</label>
        <input id="capture-email" name="email" type="email" autocomplete="email" maxlength="254" value={form?.values?.email || ''} />
        <label for="capture-phone">Telephone (optional)</label>
        <input id="capture-phone" name="phone" type="tel" autocomplete="tel" maxlength="40" value={form?.values?.phone || ''} />
        <div class="capture-trap" aria-hidden="true"><label for="capture-website">Leave blank</label><input id="capture-website" name="website_check" tabindex="-1" autocomplete="off" /></div>
        <label class="capture-consent"><input name="contactConsent" type="checkbox" value="yes" required /><span>I agree to share these details with {data.profile.name} for their private contact record and personal follow-up.</span></label>
        <p class="hint">{#if data.exchangeAvailable}If you join and verify a phone number or email you shared, the exchanged details can be saved in each person’s My People. {/if}Sharing your details leaves account creation optional and keeps private notes separate. <a href="/legal/privacy">Privacy notice</a>.</p>
        {#if form?.error}<p role="alert">{form.error}</p>{/if}
        {#if form?.reference}<p>Support reference: {form.reference}</p>{/if}
        <button class="primary" type="submit">Send</button>
      </form>
    </section>
  {/if}
</main>

<style>
  .capture-page{max-width:500px;margin:0 auto;padding:24px 20px 48px;box-sizing:border-box;overflow-wrap:anywhere}
  nav{display:flex;align-items:center;justify-content:space-between;min-height:44px;gap:20px}nav span{font-weight:750}nav a{min-height:44px;display:flex;align-items:center}
  .capture-card{margin-top:30px}h1{font-size:clamp(1.7rem,6vw,2.2rem);line-height:1.2;letter-spacing:-.035em}p{line-height:1.6}
  .avatar{border-radius:50%;object-fit:cover}form{display:grid;gap:10px}input:not([type=checkbox]){width:100%;padding:14px;min-height:50px;box-sizing:border-box;border:1px solid var(--border,#cdd6d2);border-radius:12px;font:inherit}
  .capture-consent{display:flex;gap:10px;align-items:flex-start;margin:14px 0}
  /* IT: Override global input width/padding so the checkbox cannot squeeze its text. */
  .capture-consent input[type=checkbox]{width:18px;height:18px;min-width:18px;flex:0 0 18px;padding:0;margin:3px 0 0;box-sizing:border-box}
  .capture-consent span{flex:1;min-width:0;line-height:1.5}
  .hint{font-size:.9rem;color:var(--muted,#52615b)}
  .capture-trap{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}.primary{display:flex;align-items:center;justify-content:center;min-height:54px;padding:12px 18px;width:100%;box-sizing:border-box;border:0;border-radius:14px;background:#183e39;color:#fff;font:inherit;font-weight:650;text-decoration:none;cursor:pointer}
  .eyebrow{font-size:.8rem;font-weight:650;letter-spacing:.03em}.profile-preview{margin:26px 0;border:1px solid var(--border,#dce3e0);border-radius:22px;overflow:hidden;background:var(--surface,#fff);box-shadow:0 10px 30px #183e3910}.preview-cover{height:130px;background:#dcebe5;display:grid;place-items:center;font-size:3rem;color:#183e39}.preview-body{padding:24px}.preview-body h2{margin:12px 0}.preview-body p{margin:8px 0}.later{display:block;text-align:center;padding:14px}.receipt{padding:14px;border-radius:12px;background:#e5f1ea;color:#183e39}
</style>
