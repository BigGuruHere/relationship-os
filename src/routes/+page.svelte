<!-- IT: Reuse the existing workspace tile styles for a simple, context-neutral landing page. -->
<script lang="ts">
  import type { PageData } from "./$types";
  export let data: PageData;
</script>
<svelte:head><title>Home - Relish</title></svelte:head>

<div class="workspace-page">
  <p class="workspace-kicker">MY RELISH</p>
  <h1>Welcome to Relish</h1>
  <p class="workspace-intro">Keep track of the people you meet, remember what matters, and stay connected.</p>

  <div class="workspace-tiles">
    {#if data.dorianAvailable}
      <a class="workspace-panel workspace-tile" href="/dorian">
        <span class="workspace-tile-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3m-3 0h6" />
          </svg>
        </span>
        <h2>Talk to Dorian - to build my network</h2>
        <p>Explore what matters to you and the connections you’d like to build.</p>
        <span class="workspace-tile-action">Start a conversation →</span>
      </a>
    {/if}
    <a class="workspace-panel workspace-tile" href="/people">
      <span class="workspace-tile-icon" aria-hidden="true">♧</span>
      <h2>My People</h2>
      <p>View your contacts and the notes you've saved about them.</p>
      <span class="workspace-tile-action">Open My People →</span>
    </a>
    <a class="workspace-panel workspace-tile" href="/people/new">
      <span class="workspace-tile-icon" aria-hidden="true">+</span>
      <h2>Add Person</h2>
      <p>Quickly add someone you've met, then record a voice note.</p>
      <span class="workspace-tile-action">Add someone →</span>
    </a>
    <a class="workspace-panel workspace-tile" href="/share">
      <span class="workspace-tile-icon" aria-hidden="true">▦</span>
      <h2>Share My Profile</h2>
      <p>Show your QR code or send your profile link.</p>
      <span class="workspace-tile-action">Open sharing →</span>
    </a>
    <a class="workspace-panel workspace-tile" href="/profiles">
      <span class="workspace-tile-icon" aria-hidden="true">◉</span>
      <h2>My Profiles</h2>
      <p>View the profiles you use when connecting with others.</p>
      <span class="workspace-tile-action">View profiles →</span>
    </a>
  </div>
</div>
