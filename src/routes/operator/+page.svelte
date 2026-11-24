<script lang="ts">
  import type { PageData } from "./$types";
  export let data: PageData;
</script>
<svelte:head><title>Operator tools - Relish</title></svelte:head>
<div class="workspace-page"><p class="workspace-kicker">OWNER / OPERATOR</p><h1>Operator tools</h1>
  <p class="workspace-intro">Review private understanding and measure the pilot. These screens are not part of the participant navigation.</p>
  <div class="workspace-tiles">
    {#if data.dorianReview}
      <a class="workspace-panel workspace-tile" href="/operator/dorian-foundation"><h2>Dorian conversation reviews</h2><p>Review suggested updates for future calls</p></a>
    {/if}
    <a class="workspace-panel workspace-tile" href="/general/admin/product-intelligence"><h2>Product intelligence</h2><p>Pilot journeys, conversion and return visits</p><span class="workspace-tile-action">Open →</span></a>
    <a class="workspace-panel workspace-tile" href="/general/admin/dorian-conversations"><h2>Dorian conversation monitor</h2><p>Calls, transcripts, processing and Living Understanding outcomes</p><span class="workspace-tile-action">Open →</span></a>
    <a class="workspace-panel workspace-tile" href="/general/people"><h2>People and understanding</h2><p>Operator access to appropriate participant and understanding records</p><span class="workspace-tile-action">Open →</span></a>
    <a class="workspace-panel workspace-tile" href="/general/admin/reviews"><h2>Review inbox</h2><p>Review governed understanding proposals</p><span class="workspace-tile-action">Open →</span></a>
    <a class="workspace-panel workspace-tile" href="/general/admin/pilot-phone-reviews"><h2>Telephone processing reviews</h2><p>Telephone-specific diagnostics and recovery</p><span class="workspace-tile-action">Open →</span></a>
  </div>
</div>
