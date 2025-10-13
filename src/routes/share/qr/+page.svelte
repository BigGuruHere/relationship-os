<script lang="ts">
    // PURPOSE: dedicated QR share page once a QR has been generated.
    export let data;
  
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
      <h1 style="margin:0 0 12px 0;">Share</h1>
  
      <div class="qrwrap">
        {@html data.qrSvg}
      </div>
  
      <div class="row">
        <input class="linkbox" readonly value={data.link} on:click={copyLink} />
        <button class="btn" on:click={copyLink}>Copy</button>
      </div>
  
      <div class="btnrow">
        <a class="btn" href={data.vcardUrl}>Preview vCard</a>
        <a class="btn" href={data.smsUrl}>Share by SMS</a>
        <a class="btn" href={data.whatsappUrl} target="_blank" rel="noopener">Share on WhatsApp</a>
        <a class="btn" href={data.link} target="_blank" rel="noopener">View profile</a>
      </div>
    </div>
  </div>
  
  <style>
    .qrwrap { display:flex; justify-content:center; padding:12px; }
    .row { display:flex; gap:10px; align-items:center; margin:8px 0 12px 0; }
    .linkbox { flex:1 1 auto; min-width:160px; padding:8px 10px; border:1px solid #ddd; border-radius:10px; font-family:inherit; }
    .btn { display:inline-flex; align-items:center; justify-content:center; height:36px; padding:0 12px; border:1px solid #ccc; border-radius:10px; text-decoration:none; background:#fff; color:inherit; line-height:1; cursor:pointer; }
    .btnrow { display:flex; gap:8px; flex-wrap:wrap; }
  </style>
  