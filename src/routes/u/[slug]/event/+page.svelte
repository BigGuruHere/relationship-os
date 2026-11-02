<script lang="ts">
  // Stage 8.22.5 - Temporary visitor-first event screen. The original QR page is preserved.
  import { enhance } from '$app/forms';
  export let data: any;
  export let form: any;
  let sending = false;
  $: person = data.profile;
  $: ownerName = person?.displayName || 'Your new connection';
</script>

<svelte:head>
  <title>Great to connect | Relish</title>
  <meta name="description" content="Save a connection and opt in to help shape the early Relish pilot." />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<main class="event-page">
  <div class="brand"><img src="/relish-logo.png" alt="" width="30" height="30" /> Relish</div>
  <div class="event-card">
    <div class="person-line">
      {#if person.avatarUrl}
        <img class="avatar" src={person.avatarUrl} alt="" />
      {:else}
        <div class="avatar fallback" aria-hidden="true">{ownerName.charAt(0).toUpperCase()}</div>
      {/if}
      <div class="person-text">
        <h1>{ownerName}</h1>
        <p>Founder, Relish</p>
      </div>
    </div>
    <h2>Great to connect.</h2>
    <p>I'm building Relish to help people discover and develop more valuable human relationships.</p>
    <a class="save-button" href={data.vcardUrl} download>
      <span aria-hidden="true">♧</span> Save my contact details
    </a>
    {#if person.headline}<p class="profile-line">{person.headline}</p>{/if}
  </div>

  <section class="signup-card"><h2>Simply stay in touch</h2><p>Share your details privately, without joining the pilot or creating an account.</p><a class="save-button" href={data.shareDetailsUrl}>Share your details</a></section>
  <section class="signup-card" aria-labelledby="signup-title">
    {#if form?.joined}
      <div class="success" role="status">
        <h2>Thanks for connecting.</h2>
        <p>You're on the list of people interested in testing Relish. I'll be in touch personally.</p>
        <a class="text-link" href={data.vcardUrl} download>Save my contact details</a>
      </div>
    {:else}
      <h2 id="signup-title">Interested in helping shape Relish?</h2>
      <p>I'm inviting a small group of people to try an early version of Dorian, our AI relationship partner.</p>
      <form method="POST" action="?/join" use:enhance={() => {
        sending = true;
        return async ({ update }) => { await update(); sending = false; };
      }}>
        <label for="visitor-name">Your name</label>
        <input id="visitor-name" name="name" autocomplete="name" maxlength="120" required value={form?.values?.name ?? ''} placeholder="Name" />
        <label for="visitor-email">Email</label>
        <input id="visitor-email" name="email" type="email" autocomplete="email" maxlength="254" value={form?.values?.email ?? ''} placeholder="you@example.com" />
        <div class="or">or</div>
        <label for="visitor-phone">Mobile number</label>
        <input id="visitor-phone" name="phone" type="tel" autocomplete="tel" maxlength="40" value={form?.values?.phone ?? ''} placeholder="Your mobile number" />
        <!-- IT: This hidden field is an anti-spam honeypot, not contact information. -->
        <div class="trap" aria-hidden="true"><label for="website-check">Leave blank</label><input id="website-check" name="website_check" tabindex="-1" autocomplete="off" /></div>
        <label class="consent">
          <input type="checkbox" name="pilotContactConsent" value="yes" required />
          <span>I'd like to be contacted about testing Relish.</span>
        </label>
        {#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
        <button class="join-button" type="submit" disabled={sending}>{sending ? 'Saving…' : 'Join the early test group'}</button>
      </form>
      <p class="privacy">Your details will only be used to contact you about Relish testing. This doesn't create a Relish account or give anyone access to your conversations. <a href="/legal/privacy">Privacy notice</a>.</p>
    {/if}
  </section>
  <p class="footer">Relish is about making human connections more valuable.</p>
</main>

<style>
  :global(body) { background: #f6f8f7; }
  .event-page { width: min(100%, 520px); margin: 0 auto; padding: 22px 16px 40px; color: #1b3838; }
  .brand { display:flex; align-items:center; gap:8px; font-size:1.15rem; font-weight:800; margin: 0 0 24px; letter-spacing:-.02em; }
  .event-card, .signup-card { border:1px solid #e0e9e6; background:#fff; border-radius:18px; box-shadow:0 12px 32px rgba(24,62,56,.06); padding:24px; margin-bottom:16px; }
  .person-line { display:flex; align-items:center; gap:14px; margin-bottom:28px; }
  .avatar { width:60px; height:60px; border-radius:50%; flex:0 0 auto; object-fit:cover; }
  .fallback { display:grid; place-items:center; background:#dce8e3; color:#21584d; font-size:1.6rem; font-weight:800; }
  .person-text { min-width:0; }
  h1 { font-size:1.33rem; line-height:1.25; margin:0 0 3px; }
  .person-text p { margin:0; color:#57716b; font-size:.94rem; }
  h2 { font-size:1.38rem; line-height:1.3; letter-spacing:-.025em; margin:0 0 13px; }
  p { line-height:1.55; margin:0 0 18px; }
  .event-card > p { color:#42615a; }
  .save-button, .join-button { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; min-height:48px; border:0; border-radius:11px; font-weight:700; font-size:1rem; background:#1b5549; color:white; text-decoration:none; cursor:pointer; text-align:center; padding:12px; }
  .save-button:hover, .join-button:hover { background:#143f36; }
  .join-button:disabled { opacity:.65; cursor:wait; }
  .event-card .profile-line { margin:15px 0 0; font-size:.85rem; color:#6b7d79; }
  .signup-card h2 { margin-bottom:10px; }
  .signup-card > p { color:#526e66; }
  form { display:flex; flex-direction:column; gap:9px; }
  label { font-size:.9rem; font-weight:700; }
  input:not([type=checkbox]) { width:100%; border:1px solid #cfdbd6; border-radius:10px; min-height:46px; font:inherit; padding:10px 12px; background:#fff; color:#172f2e; }
  input:focus-visible, a:focus-visible, button:focus-visible { outline:3px solid #85ae9d; outline-offset:2px; }
  .or { text-align:center; color:#8a9e98; font-size:.83rem; margin:0; }
  .consent { display:flex; align-items:flex-start; gap:10px; font-size:.87rem; font-weight:400; line-height:1.5; margin:14px 0 8px; cursor:pointer; }
  .consent input { flex:0 0 auto; margin-top:5px; width:17px; height:17px; }
  .privacy { margin:15px 0 0; font-size:.76rem; color:#6b7d79; }
  .privacy a, .text-link { color:#1b5549; }
  .error { background:#fff1ee; color:#a33c30; border-radius:9px; padding:10px; margin:0; font-size:.9rem; }
  .success p { color:#526e66; }
  .trap { position:absolute; left:-10000px; width:1px; height:1px; overflow:hidden; }
  .footer { text-align:center; font-size:.82rem; color:#71847f; margin-top:20px; }
  @media(max-width:420px) { .event-card,.signup-card { padding:20px; } .event-page { padding:16px 12px 32px; } }
</style>
