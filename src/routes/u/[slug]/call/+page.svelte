<script lang="ts">
  export let data: any;
  export let form: any;
  let shareContact = false;
  // Clicking the SMS link opens the phone's messages app. The visitor must press Send.
  $: smsHref = form?.issued
    ? `sms:${form.issued.smsTo}?body=${encodeURIComponent(form.issued.smsText)}` : '';
</script>
<svelte:head>
  <title>Call Dorian - {data.contextLabel} - Relish</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>
<main class="sms-page">
  <a href={'/u/' + encodeURIComponent(data.slug)} class="back">← Back to {data.profileName}'s profile</a>
  <section class="sms-card">
    <div class="eyebrow">{data.contextLabel} / RELISH</div>
    <h1>Talk with Dorian</h1>
    <p>Dorian is Relish's AI conversational partner. Your conversation is private to you and will not be shared with {data.profileName}.</p>
    {#if data.mode === 'BROWSER'}
      <p>This profile has chosen browser conversations. Return to the profile and choose Talk with Dorian.</p>
    {:else if !data.ready}
      <p role="alert">Telephone conversations are not yet configured for this pilot. Please try again later.</p>
    {:else if form?.issued}
      <h2>Send your invitation by SMS</h2>
      <p>Your phone will open a message addressed to Dorian. Tap <strong>Send</strong>. After Relish receives it, Dorian will call you back.</p>
      <a class="main-button" href={smsHref}>Open SMS to Dorian</a>
      <div class="instruction"><strong>If SMS does not open:</strong><p>Text <code>{form.issued.smsText}</code> to <strong>{form.issued.smsTo}</strong>.</p>
        <p>This invitation expires in {form.issued.expiresMinutes} minutes and works only once. Do not share the invitation code.</p></div>
      <p class="subtle">The number you text from will be used for provisional recognition on future Dorian calls. Calls may incur carrier charges.</p>
    {:else}
      <h2>Have Dorian call you</h2>
      <p>1. Confirm you understand the conversation and privacy terms.</p>
      <p>2. Send a prefilled SMS from your mobile to Dorian.</p>
      <p>3. Dorian calls you back from the same number you can save for future calls.</p>
      <form method="POST" action="?/request" class="sms-form">
        <label class="check"><input type="checkbox" name="agreeTerms" value="yes" required />
          <span>I have read and agree to the <a href={data.termsUrl} target="_blank" rel="noopener noreferrer">Terms ({data.version})</a> and <a href={data.privacyUrl} target="_blank" rel="noopener noreferrer">Privacy Notice</a>. I understand Dorian is AI and calls may be transcribed and used to develop my private understanding.</span>
        </label>
        <label class="check"><input type="checkbox" name="shareContact" value="yes" bind:checked={shareContact} />
          <span>Also share my name and email with {data.profileName} so we can stay connected. This does not share my conversation or private understanding.</span>
        </label>
        {#if shareContact}
          <label>Your name <input name="name" maxlength="90" required autocomplete="name" /></label>
          <label>Your email <input name="email" type="email" maxlength="254" required autocomplete="email" /></label>
        {/if}
        <button type="submit" class="main-button">Continue to SMS</button>
      </form>
      {#if form?.error}<p role="alert">{form.error}</p>{/if}
    {/if}
  </section>
</main>
<style>
  .sms-page{width:100%;max-width:520px;margin:0 auto;padding:16px;box-sizing:border-box;overflow-wrap:anywhere}
  .back{display:inline-block;margin:10px 0 20px;color:inherit}
  .sms-card{width:100%;box-sizing:border-box;padding:22px;border:1px solid #e5e7eb;border-radius:18px;background:var(--surface,#fff)}
  .eyebrow{font-size:12px;letter-spacing:.08em;color:#607076;font-weight:700}
  h1{font-size:clamp(26px,7vw,34px);line-height:1.15;margin:14px 0}
  h2{font-size:21px;margin:24px 0 12px} p{line-height:1.55}
  .sms-form{display:grid;gap:18px;margin-top:22px}
  .sms-form label:not(.check){display:grid;gap:7px}
  .sms-form input:not([type=checkbox]){width:100%;min-width:0;max-width:100%;box-sizing:border-box;border:1px solid #b9bfc7;border-radius:10px;padding:11px;font:inherit}
  .check{display:flex;align-items:flex-start;gap:12px;font-size:14px;line-height:1.5}
  .check input{margin-top:4px;flex:none;width:18px;height:18px}
  .main-button{width:100%;display:block;box-sizing:border-box;background:#182b32;color:white;padding:16px;border:none;border-radius:12px;font-weight:650;font-size:16px;cursor:pointer;text-align:center;text-decoration:none}
  .instruction{background:#f1f5f6;border-radius:12px;padding:14px;margin-top:18px}
  .instruction code{user-select:all;overflow-wrap:anywhere}
  .subtle{font-size:13px;color:#64748b}
  @media(max-width:420px){.sms-card{padding:18px}.sms-page{padding:12px}}
</style>
