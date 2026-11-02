<script lang="ts">export let data; export let form: any;</script>
<svelte:head><title>Share your details - Relish</title><meta name="robots" content="noindex"/></svelte:head>
<main class="capture-page">
<a href={'/u/' + encodeURIComponent(data.profile.slug) + '?original=1'}>← View profile</a>
<section class="capture-card">
{#if data.profile.avatarUrl}<img src={data.profile.avatarUrl} alt="" width="64" height="64"/>{/if}
<h1>Share your details with {data.profile.name}</h1>{#if data.profile.headline}<p>{data.profile.headline}</p>{/if}
{#if form?.shared}<div role="status"><h2>Thank you</h2><p>Your details have been shared for a private contact record. You do not need to create an account or take any other action.</p></div>
{:else}
<p>Let {data.profile.name} save your details privately and follow up after meeting you.</p>
<form method="POST">
<input type="hidden" name="captureToken" value={data.captureToken}/>
<label for="capture-name">Your name</label><input id="capture-name" name="name" autocomplete="name" maxlength="200" required value={form?.values?.name || ''}/>
<label for="capture-email">Email (optional)</label><input id="capture-email" name="email" type="email" autocomplete="email" maxlength="254" value={form?.values?.email || ''}/>
<label for="capture-phone">Telephone (optional)</label><input id="capture-phone" name="phone" type="tel" autocomplete="tel" maxlength="40" value={form?.values?.phone || ''}/>
<div class="capture-trap" aria-hidden="true"><label for="capture-website">Leave blank</label><input id="capture-website" name="website_check" tabindex="-1" autocomplete="off"/></div>
<label class="capture-consent"><input name="contactConsent" type="checkbox" value="yes" required/><span>I agree to share these details with {data.profile.name} for their private contact record and personal follow-up.</span></label>
<p class="capture-privacy">This does not create a Relish account, mutual connection or pilot signup. It does not give either of you access to the other's private notes. <a href="/legal/privacy">Privacy notice</a>.</p>
{#if form?.error}<p role="alert">{form.error}</p>{/if}{#if form?.reference}<p>Support reference: {form.reference}</p>{/if}<button class="btn primary">Share my details</button>
</form>{/if}</section></main>
<style>.capture-page{max-width:540px;margin:0 auto;padding:24px 16px}.capture-card{margin-top:20px;padding:24px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}h1{font-size:1.6rem;line-height:1.3;overflow-wrap:anywhere}img{border-radius:50%;object-fit:cover}form{display:grid;gap:10px}input:not([type=checkbox]){width:100%;padding:12px;min-height:46px}.capture-consent{display:flex;gap:10px;align-items:flex-start;margin:14px 0}.capture-consent input{margin-top:5px}.capture-privacy{font-size:.9rem}.capture-trap{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}button{min-height:48px;width:100%}</style>
