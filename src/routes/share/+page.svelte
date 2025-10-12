<script lang="ts">
    // PURPOSE: show QR and share options for the current user's universal link.
    // SECURITY: no decryption here. All values are public display items.
    export let data;
  
    import QRCode from 'qrcode'; // client side QR generation
  
    let qrDataUrl = '';
  
    // Build QR in onMount so it runs in the browser only
    import { onMount } from 'svelte';
    onMount(async () => {
      if (data.link) {
        // Generate a data URL PNG for the QR code
        // Quiet zone gives a small margin around the code for better scanning
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
  
      {#if data.needsSlug}
        <p style="color:#666;">Set your public link first.</p>
        <a class="btn primary" href={data.profileUrl}>Set public link</a>
      {:else}
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; gap:10px; align-items:center;">
            <input class="linkbox" readonly value={data.link} on:click={copyLink} />
            <button class="btn" on:click={copyLink}>Copy</button>
          </div>
  
          {#if qrDataUrl}
            <div style="display:flex; justify-content:center; padding:12px;">
              <img src={qrDataUrl} alt="QR code for your link" width="180" height="180" />
            </div>
          {/if}
  
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <a class="btn" href={data.vcardUrl}>Save my contact</a>
            <a class="btn" href={data.smsUrl}>Share by SMS</a>
            <a class="btn" href={data.whatsappUrl} target="_blank" rel="noopener">Share on WhatsApp</a>
            <a class="btn" href={"/u/" + data.link.split('/').pop()}>Preview public page</a>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <style>
    .btn { padding:8px 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; }
    .btn.primary { background:#111; color:#fff; border-color:#111; }
    .linkbox {
      flex: 1 1 auto;
      min-width: 160px;
      padding: 8px 10px;
      border: 1px solid #ddd;
      border-radius: 10px;
      font-family: inherit;
    }
  </style>
  