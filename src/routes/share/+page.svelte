<script lang="ts">
  // PURPOSE: show QR and share options for the current user's universal link.
  // SAFETY: never read slug here - use server built data.link only.
  // UX: includes Preview vCard, SMS, WhatsApp, Preview public page, and Edit public page.
  export let data;

  import QRCode from 'qrcode';
  import { onMount } from 'svelte';

  let qrDataUrl = '';

  // Build the QR image only in the browser
  onMount(async () => {
    if (data.link) {
      qrDataUrl = await QRCode.toDataURL(data.link, { margin: 2, scale: 6 });
    }
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(data.link);
      alert('Link copied');
    } catch {
      alert('Could not copy. Long press the link to copy.');
    }
  }
</script>

<div class="container">
  <div class="card" style="padding:16px; max-width:520px; margin:0 auto;">
    <h1 style="margin:0 0 12px 0;">Share your link</h1>

    {#if data.profile?.isBlank}
      <div class="note">
        Your public page is not set up yet. Click Preview public page, then the edit icon to add your details.
      </div>
    {/if}

    <div class="row">
      <input class="linkbox" readonly value={data.link} on:click={copyLink} />
      <button class="btn" on:click={copyLink}>Copy</button>
    </div>

    {#if qrDataUrl}
      <div class="qrwrap">
        <img src={qrDataUrl} alt="QR code for your link" width="180" height="180" />
      </div>
    {/if}

    <div class="btnrow">
      <a class="btn" href={data.vcardUrl}>Preview vCard</a>
      <a class="btn" href={data.smsUrl}>Share by SMS</a>
      <a class="btn" href={data.whatsappUrl} target="_blank" rel="noopener">Share on WhatsApp</a>
      <a class="btn" href={data.link} target="_blank" rel="noopener">Preview public page</a>
      <a class="btn" href={data.link + '?edit=1'} target="_blank" rel="noopener">Edit public page</a>
    </div>
  </div>
</div>

<style>
  .row { display:flex; gap:10px; align-items:center; margin:8px 0 12px 0; }
  .linkbox {
    flex: 1 1 auto;
    min-width: 160px;
    padding: 8px 10px;
    border: 1px solid #ddd;
    border-radius: 10px;
    font-family: inherit;
  }
  .qrwrap { display:flex; justify-content:center; padding:12px; }

  /* Unify button sizing across <a> and <button> */
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
  .btnrow { display:flex; gap:8px; flex-wrap:wrap; }
  .note {
    background: #f6f7f8;
    border: 1px solid #e3e4e6;
    border-radius: 10px;
    padding: 8px 10px;
    color: #444;
    margin-bottom: 10px;
    font-size: 0.95rem;
  }
</style>
